// ===== Lobby: screen switching + Socket.IO room create/join (name + password) =====
const lobbyScreen = document.getElementById('lobbyScreen');
const scoreboardWrap = document.getElementById('scoreboardWrap');
const gameCanvas = document.getElementById('game');
const controlsPanel = document.getElementById('controlsPanel');
const hintText = document.getElementById('hintText');
const restartBtn = document.getElementById('restartBtn');
const rematchBtn = document.getElementById('rematchBtn');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');
const waitingBox = document.getElementById('waitingBox');
const waitingText = document.getElementById('waitingText');
const lobbyError = document.getElementById('lobbyError');
const zoneOverlay = document.getElementById('zoneOverlay');
const turnBanner = document.getElementById('turnBanner');

window.socket = window.io ? io() : null;

function hide(el) { el && el.classList.add('hidden'); }
function show(el) { el && el.classList.remove('hidden'); }

window.showLobbyScreen = function () {
  show(lobbyScreen);
  hide(waitingBox); hide(lobbyError);
  hideAllGameUI();
};

function hideAllGameUI() {
  hide(scoreboardWrap); hide(gameCanvas); hide(controlsPanel);
  hide(hintText); hide(restartBtn); hide(rematchBtn); hide(backToLobbyBtn);
  hide(zoneOverlay); hide(turnBanner);
}

function enterGameShell(mode) {
  window.currentMode = mode;
  hide(lobbyScreen);
  show(scoreboardWrap); show(gameCanvas); show(backToLobbyBtn);
}

function currentPlayerName() {
  const v = document.getElementById('playerNameInput').value.trim();
  return v.slice(0, 20) || 'Player';
}

function showLobbyError(msg) {
  lobbyError.textContent = msg;
  show(lobbyError);
}

// ---- Practice mode (no login required) ----
document.getElementById('practiceFromLobbyBtn').addEventListener('click', startPractice);

function startPractice() {
  enterGameShell('solo');
  show(controlsPanel); show(hintText); show(restartBtn);
  hide(zoneOverlay); hide(turnBanner);
  document.getElementById('sbTitle').textContent = 'STADIUM STRIKER';
  document.getElementById('sbLeftLabel').textContent = 'GOALS';
  document.getElementById('sbRightLabel').textContent = 'TIME';
  hintText.textContent = 'Desktop: Arrow keys / WASD to move, hold Space to charge shot | Mobile: use the pad and hold KICK';
  window.StadiumMultiplayer?.leave();
  window.StadiumSolo.start();
}

// ---- Create / Join room ----
document.getElementById('createRoomBtn').addEventListener('click', () => {
  hide(lobbyError);
  const roomName = document.getElementById('createRoomNameInput').value.trim();
  const password = document.getElementById('createRoomPassInput').value.trim();
  if (!roomName) return showLobbyError('Enter a room name.');
  if (!password) return showLobbyError('Enter a room password.');
  window.socket.emit('create-room', { roomName, password, playerName: currentPlayerName() });
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  hide(lobbyError);
  const roomName = document.getElementById('joinRoomNameInput').value.trim();
  const password = document.getElementById('joinRoomPassInput').value.trim();
  if (!roomName) return showLobbyError('Enter the room name.');
  if (!password) return showLobbyError('Enter the room password.');
  window.socket.emit('join-room', { roomName, password, playerName: currentPlayerName() });
});

document.getElementById('cancelWaitBtn').addEventListener('click', () => {
  window.socket.emit('leave-room');
  hide(waitingBox);
});

backToLobbyBtn.addEventListener('click', () => {
  window.StadiumSolo?.stop();
  window.StadiumMultiplayer?.leave();
  window.socket?.emit('leave-room');
  window.showLobbyScreen();
});

if (window.socket) {
  window.socket.on('room-created', ({ roomName }) => {
    show(waitingBox);
    waitingText.textContent = `Room "${roomName}" created. Share the room name and password with a friend — waiting for them to join…`;
    window.currentRoomName = roomName;
  });

  window.socket.on('room-error', ({ message }) => showLobbyError(message));

  window.socket.on('room-joined', ({ roomName }) => {
    window.currentRoomName = roomName;
    hide(lobbyError);
  });

  window.socket.on('match-start', data => {
    hide(waitingBox);
    enterGameShell('online');
    hide(controlsPanel); hide(hintText); hide(restartBtn); hide(rematchBtn);
    window.StadiumMultiplayer.begin(data);
  });

  window.socket.on('opponent-left', () => {
    if (window.currentMode === 'online') alert('Your opponent left the match.');
    window.StadiumMultiplayer?.leave();
    window.showLobbyScreen();
  });
}
