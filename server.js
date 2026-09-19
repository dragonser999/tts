// ===== Stadium Striker server: static hosting + name/password rooms + online play =====
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ================= online rooms (penalty shootout) =================
const KICKS_PER_PLAYER = 5;
const rooms = new Map(); // roomKey (uppercase name) -> room state

function freshRoomState(displayName, password) {
  return {
    displayName,
    password,
    players: [],          // [{socketId, name}]
    phase: 'waiting',      // waiting | playing | sudden | finished
    kickNumber: 0,
    scores: [0, 0],
    kicksTaken: [0, 0],
    choices: {},
    suddenRound: 0
  };
}

function shooterIndex(room) { return room.kickNumber % 2; }
function keeperIndex(room) { return (room.kickNumber % 2) === 0 ? 1 : 0; }
function publicPlayers(room) { return room.players.map(p => ({ name: p.name })); }

function checkEarlyFinish(room) {
  if (room.phase === 'sudden') return null;
  const remaining = [
    KICKS_PER_PLAYER - room.kicksTaken[0],
    KICKS_PER_PLAYER - room.kicksTaken[1]
  ];
  if (room.scores[0] > room.scores[1] + remaining[1]) return 0;
  if (room.scores[1] > room.scores[0] + remaining[0]) return 1;
  if (room.kicksTaken[0] >= KICKS_PER_PLAYER && room.kicksTaken[1] >= KICKS_PER_PLAYER) {
    if (room.scores[0] !== room.scores[1]) return room.scores[0] > room.scores[1] ? 0 : 1;
    return 'sudden';
  }
  return null;
}

function resolveKick(key) {
  const room = rooms.get(key);
  if (!room) return;
  const { shooter, keeper } = room.choices;
  if (shooter === undefined || keeper === undefined) return;

  const sIdx = shooterIndex(room);
  const kIdx = keeperIndex(room);
  const scored = shooter !== keeper;
  if (scored) room.scores[sIdx]++;
  room.kicksTaken[sIdx]++;

  io.to(key).emit('kick-result', {
    shooterZone: shooter,
    keeperZone: keeper,
    scored,
    scores: room.scores,
    shooterIndex: sIdx,
    keeperIndex: kIdx,
    kicksTaken: room.kicksTaken
  });

  room.choices = {};

  const outcome = checkEarlyFinish(room);
  setTimeout(() => {
    if (outcome === 'sudden') {
      room.phase = 'sudden';
      room.kickNumber++;
      io.to(key).emit('next-kick', { shooterIndex: shooterIndex(room), phase: room.phase, kickNumber: room.kickNumber });
    } else if (outcome === 0 || outcome === 1) {
      room.phase = 'finished';
      io.to(key).emit('match-end', { winner: outcome, scores: room.scores });
    } else if (room.phase === 'sudden') {
      room.kickNumber++;
      const justFinishedPair = room.kickNumber % 2 === 0;
      if (justFinishedPair && room.scores[0] !== room.scores[1]) {
        room.phase = 'finished';
        const winner = room.scores[0] > room.scores[1] ? 0 : 1;
        io.to(key).emit('match-end', { winner, scores: room.scores });
      } else {
        io.to(key).emit('next-kick', { shooterIndex: shooterIndex(room), phase: room.phase, kickNumber: room.kickNumber });
      }
    } else {
      room.kickNumber++;
      io.to(key).emit('next-kick', { shooterIndex: shooterIndex(room), phase: room.phase, kickNumber: room.kickNumber });
    }
  }, 1600);
}

io.on('connection', socket => {
  socket.on('create-room', ({ roomName, password, playerName }) => {
    const name = (playerName || 'Player 1').trim().slice(0, 20) || 'Player 1';
    const rn = (roomName || '').trim();
    const pw = (password || '').trim();
    if (!rn) return socket.emit('room-error', { message: 'Room name is required.' });
    if (!pw) return socket.emit('room-error', { message: 'Room password is required.' });

    const key = rn.toUpperCase();
    if (rooms.has(key)) return socket.emit('room-error', { message: 'That room name is already taken.' });

    const room = freshRoomState(rn, pw);
    room.players.push({ socketId: socket.id, name });
    rooms.set(key, room);
    socket.join(key);
    socket.data.roomKey = key;
    socket.emit('your-index', { index: 0 });
    socket.emit('room-created', { roomName: rn });
  });

  socket.on('join-room', ({ roomName, password, playerName }) => {
    const name = (playerName || 'Player 2').trim().slice(0, 20) || 'Player 2';
    const key = (roomName || '').trim().toUpperCase();
    const room = rooms.get(key);
    if (!room) return socket.emit('room-error', { message: 'Room not found.' });
    if (room.password !== (password || '').trim()) return socket.emit('room-error', { message: 'Incorrect room password.' });
    if (room.players.length >= 2) return socket.emit('room-error', { message: 'Room is full.' });

    room.players.push({ socketId: socket.id, name });
    socket.join(key);
    socket.data.roomKey = key;
    socket.emit('your-index', { index: room.players.length - 1 });

    io.to(key).emit('room-joined', { roomName: room.displayName, players: publicPlayers(room) });

    if (room.players.length === 2) {
      room.phase = 'playing';
      room.kickNumber = 0;
      io.to(key).emit('match-start', { players: publicPlayers(room), shooterIndex: shooterIndex(room) });
    }
  });

  socket.on('submit-choice', ({ zone }) => {
    const key = socket.data.roomKey;
    const room = rooms.get(key);
    if (!room || room.phase === 'finished') return;
    const sIdx = shooterIndex(room);
    const kIdx = keeperIndex(room);
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;
    const playerIdx = room.players.indexOf(player);

    if (playerIdx === sIdx) room.choices.shooter = zone;
    else if (playerIdx === kIdx) room.choices.keeper = zone;

    const bothIn = room.choices.shooter !== undefined && room.choices.keeper !== undefined;
    io.to(key).emit('opponent-ready', { shooterReady: room.choices.shooter !== undefined, keeperReady: room.choices.keeper !== undefined });
    if (bothIn) resolveKick(key);
  });

  socket.on('rematch', () => {
    const key = socket.data.roomKey;
    const room = rooms.get(key);
    if (!room || room.players.length !== 2) return;
    const players = room.players;
    const displayName = room.displayName, password = room.password;
    Object.assign(room, freshRoomState(displayName, password));
    room.players = players;
    room.phase = 'playing';
    io.to(key).emit('match-start', { players: publicPlayers(room), shooterIndex: shooterIndex(room) });
  });

  socket.on('leave-room', () => cleanupSocket(socket));
  socket.on('disconnect', () => cleanupSocket(socket));

  function cleanupSocket(sock) {
    const key = sock.data.roomKey;
    if (!key) return;
    const room = rooms.get(key);
    if (!room) return;
    room.players = room.players.filter(p => p.socketId !== sock.id);
    io.to(key).emit('opponent-left');
    rooms.delete(key);
    sock.data.roomKey = null;
  }
});

server.listen(PORT, () => {
  console.log(`Stadium Striker running on port ${PORT}`);
});
