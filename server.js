// ===== Stadium Striker server: static hosting + Google Sign-In + online rooms =====
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const session = require('express-session');

const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'stadium-striker-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 }
}));
app.use(express.static(path.join(__dirname)));

// expose the Google client id to the frontend without hardcoding it in HTML
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.GOOGLE_CLIENT_ID = ${JSON.stringify(GOOGLE_CLIENT_ID)};`);
});

// verify the Google ID token sent by the frontend after sign-in
app.post('/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'missing credential' });
    if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'server missing GOOGLE_CLIENT_ID' });

    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const user = {
      id: payload.sub,
      name: payload.name || payload.email,
      picture: payload.picture || '',
      email: payload.email
    };
    req.session.user = user;
    res.json({ user });
  } catch (err) {
    console.error('Google auth failed:', err.message);
    res.status(401).json({ error: 'invalid token' });
  }
});

app.get('/auth/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ================= online rooms (penalty shootout) =================
const ZONES = 5; // 0..4 target/dive zones
const KICKS_PER_PLAYER = 5;
const rooms = new Map(); // code -> room state

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function freshRoomState() {
  return {
    players: [],          // [{socketId, name, picture}]
    phase: 'waiting',      // waiting | playing | sudden | finished
    kickNumber: 0,
    scores: [0, 0],
    kicksTaken: [0, 0],
    choices: {},           // { shooter: zone, keeper: zone }
    suddenRound: 0
  };
}

function shooterIndex(room) {
  return room.kickNumber % 2;
}
function keeperIndex(room) {
  return (room.kickNumber % 2) === 0 ? 1 : 0;
}

function publicPlayers(room) {
  return room.players.map(p => ({ name: p.name, picture: p.picture }));
}

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

function resolveKick(code) {
  const room = rooms.get(code);
  if (!room) return;
  const { shooter, keeper } = room.choices;
  if (shooter === undefined || keeper === undefined) return;

  const sIdx = shooterIndex(room);
  const kIdx = keeperIndex(room);
  const scored = shooter !== keeper;
  if (scored) room.scores[sIdx]++;
  room.kicksTaken[sIdx]++;

  io.to(code).emit('kick-result', {
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
      io.to(code).emit('next-kick', {
        shooterIndex: shooterIndex(room), phase: room.phase, kickNumber: room.kickNumber
      });
    } else if (outcome === 0 || outcome === 1) {
      room.phase = 'finished';
      io.to(code).emit('match-end', { winner: outcome, scores: room.scores });
    } else if (room.phase === 'sudden') {
      // sudden death: decide after each full pair (both have shot once more)
      room.kickNumber++;
      const justFinishedPair = room.kickNumber % 2 === 0;
      if (justFinishedPair && room.scores[0] !== room.scores[1]) {
        room.phase = 'finished';
        const winner = room.scores[0] > room.scores[1] ? 0 : 1;
        io.to(code).emit('match-end', { winner, scores: room.scores });
      } else {
        io.to(code).emit('next-kick', {
          shooterIndex: shooterIndex(room), phase: room.phase, kickNumber: room.kickNumber
        });
      }
    } else {
      room.kickNumber++;
      io.to(code).emit('next-kick', {
        shooterIndex: shooterIndex(room), phase: room.phase, kickNumber: room.kickNumber
      });
    }
  }, 1600);
}

io.on('connection', socket => {
  socket.on('create-room', ({ user }) => {
    const code = makeCode();
    const room = freshRoomState();
    room.players.push({ socketId: socket.id, name: user?.name || 'Player 1', picture: user?.picture || '' });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('your-index', { index: 0 });
    socket.emit('room-created', { code });
  });

  socket.on('join-room', ({ code, user }) => {
    code = (code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('join-error', { message: 'Room not found.' });
    if (room.players.length >= 2) return socket.emit('join-error', { message: 'Room is full.' });

    room.players.push({ socketId: socket.id, name: user?.name || 'Player 2', picture: user?.picture || '' });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('your-index', { index: room.players.length - 1 });

    io.to(code).emit('room-joined', { code, players: publicPlayers(room) });

    if (room.players.length === 2) {
      room.phase = 'playing';
      room.kickNumber = 0;
      io.to(code).emit('match-start', {
        players: publicPlayers(room),
        shooterIndex: shooterIndex(room)
      });
    }
  });

  socket.on('submit-choice', ({ code, zone }) => {
    const room = rooms.get(code);
    if (!room || room.phase === 'finished') return;
    const sIdx = shooterIndex(room);
    const kIdx = keeperIndex(room);
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;
    const playerIdx = room.players.indexOf(player);

    if (playerIdx === sIdx) room.choices.shooter = zone;
    else if (playerIdx === kIdx) room.choices.keeper = zone;

    const bothIn = room.choices.shooter !== undefined && room.choices.keeper !== undefined;
    io.to(code).emit('opponent-ready', { shooterReady: room.choices.shooter !== undefined, keeperReady: room.choices.keeper !== undefined });
    if (bothIn) resolveKick(code);
  });

  socket.on('rematch', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.players.length !== 2) return;
    const players = room.players;
    Object.assign(room, freshRoomState());
    room.players = players;
    room.phase = 'playing';
    io.to(code).emit('match-start', { players: publicPlayers(room), shooterIndex: shooterIndex(room) });
  });

  socket.on('leave-room', () => cleanupSocket(socket));
  socket.on('disconnect', () => cleanupSocket(socket));

  function cleanupSocket(sock) {
    const code = sock.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.players = room.players.filter(p => p.socketId !== sock.id);
    if (room.players.length === 0) {
      rooms.delete(code);
    } else {
      io.to(code).emit('opponent-left');
      rooms.delete(code);
    }
    sock.data.roomCode = null;
  }
});

server.listen(PORT, () => {
  console.log(`Stadium Striker running on port ${PORT}`);
});
