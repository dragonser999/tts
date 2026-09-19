// ===== Lobby: screen switching + Socket.IO room create/join =====
const loginScreen = document.getElementById('loginScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const scoreboardWrap = document.getElementById('scoreboardWrap');
const gameCanvas = document.getElementById('game');
const controlsPanel = document.getElementById('controlsPanel');
const hintText = document.getElementById('hintText');
const restartBtn = document.getElementById('restartBtn');
const rematchBtn = document.getElementById('rematchBtn');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');
const waitingBox = document.getElementById('waitingBox');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const lobbyError = document.getElementById('lobbyError');
const zoneOverlay = document.getElementById('zoneOverlay');
const turnBanner = document.getElementById('turnBanner');

let currentMode = null; // 'solo' | 'online'
window.socket = window.io ? io() : null;

function hide(el) { el && el.classList.add('hidden'); }
function show(el) { el && el.classList.remove('hidden'); }

window.showLoginScreen = function () {
  show(loginScreen); hide(lobbyScreen);
  hideAllGameUI();
};

window.showLobbyScreen = function (user) {
  hide(loginScreen); show(lobbyScreen);
  document.getElementById('userName').textContent = user.name;
  const pic = document.getElementById('userPic');
  if (user.picture) { pic.src = user.picture; show(pic); } else { hide(pic); }
  hide(waitingBox); hide(lobbyError);
  hideAllGameUI();
};

function hideAllGameUI() {
  hide(scoreboardWrap); hide(gameCanvas); hide(controlsPanel);
  hide(hintText); hide(restartBtn); hide(rematchBtn); hide(backToLobbyBtn);
  hide(zoneOverlay); hide(turnBanner);
}

function enterGameShell(mode) {
  currentMode = mode;
  window.currentMode = mode;
  hide(loginScreen); hide(lobbyScreen);
  show(scoreboardWrap); show(gameCanvas); show(backToLobbyBtn);
}

// ---- Practice mode (no login required) ----
document.getElementById('practiceBtn').addEventListener('click', startPractice);
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
  if (!window.socket) return;
  window.socket.emit('create-room', { user: window.currentUser });
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
  if (!code) return;
  window.socket.emit('join-room', { code, user: window.currentUser });
});

document.getElementById('cancelWaitBtn').addEventListener('click', () => {
  window.socket.emit('leave-room');
  hide(waitingBox);
});

backToLobbyBtn.addEventListener('click', () => {
  window.StadiumSolo?.stop();
  window.StadiumMultiplayer?.leave();
  window.socket?.emit('leave-room');
  if (window.currentUser) window.showLobbyScreen(window.currentUser);
  else window.showLoginScreen();
});

if (window.socket) {
  window.socket.on('room-created', ({ code }) => {
    show(waitingBox);
    roomCodeDisplay.textContent = code;
    window.currentRoomCode = code;
  });

  window.socket.on('join-error', ({ message }) => {
    lobbyError.textContent = message;
    show(lobbyError);
  });

  window.socket.on('room-joined', ({ code }) => {
    window.currentRoomCode = code;
    hide(lobbyError);
  });

  window.socket.on('match-start', data => {
    hide(waitingBox);
    enterGameShell('online');
    hide(controlsPanel); hide(hintText); hide(restartBtn); hide(rematchBtn);
    window.StadiumMultiplayer.begin(data, window.currentRoomCode);
  });

  window.socket.on('opponent-left', () => {
    alert('Your opponent left the match.');
    window.StadiumMultiplayer?.leave();
    if (window.currentUser) window.showLobbyScreen(window.currentUser);
    else window.showLoginScreen();
  });
}
