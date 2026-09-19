// ===== Online 1v1 penalty shootout, synced over Socket.IO =====
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const zoneOverlay = document.getElementById('zoneOverlay');
  const turnBanner = document.getElementById('turnBanner');
  const messageEl = document.getElementById('message');
  const rematchBtn = document.getElementById('rematchBtn');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const sbLeftLabel = document.getElementById('sbLeftLabel');
  const sbRightLabel = document.getElementById('sbRightLabel');
  const sbTitle = document.getElementById('sbTitle');

  const GOAL_X = 60, GOAL_Y = 60, GOAL_W = W - 120, GOAL_H = 220;
  // 5 zones: 0 top-left, 1 top-right, 2 center, 3 bottom-left, 4 bottom-right
  const ZONE_RECTS = [
    { x: GOAL_X, y: GOAL_Y, w: GOAL_W / 2, h: GOAL_H / 2 },
    { x: GOAL_X + GOAL_W / 2, y: GOAL_Y, w: GOAL_W / 2, h: GOAL_H / 2 },
    { x: GOAL_X + GOAL_W / 4, y: GOAL_Y + GOAL_H / 4, w: GOAL_W / 2, h: GOAL_H / 2 },
    { x: GOAL_X, y: GOAL_Y + GOAL_H / 2, w: GOAL_W / 2, h: GOAL_H / 2 },
    { x: GOAL_X + GOAL_W / 2, y: GOAL_Y + GOAL_H / 2, w: GOAL_W / 2, h: GOAL_H / 2 }
  ];

  let myIndex = 0;
  let players = [];
  let shooterIdx = 0;
  let scores = [0, 0];
  let selectedZone = null;
  let lastResult = null; // { shooterZone, keeperZone, scored }
  let locked = false;

  window.socket?.on('your-index', ({ index }) => { myIndex = index; });

  function begin(data) {
    players = data.players;
    shooterIdx = data.shooterIndex;
    scores = [0, 0];
    lastResult = null;
    selectedZone = null;
    locked = false;
    hide(rematchBtn);
    updateScoreboard();
    startTurn();
    render();
  }

  function startTurn() {
    locked = false;
    selectedZone = null;
    const iAmShooter = myIndex === shooterIdx;
    turnBanner.textContent = iAmShooter
      ? 'Your turn to SHOOT — pick a target zone'
      : `${players[shooterIdx]?.name || 'Opponent'} is shooting — pick where to DIVE`;
    show(turnBanner);
    buildZoneButtons(iAmShooter ? 'Aim' : 'Dive');
    hide(messageEl);
    render();
  }

  function buildZoneButtons(label) {
    zoneOverlay.innerHTML = '';
    show(zoneOverlay);
    ZONE_RECTS.forEach((z, i) => {
      const btn = document.createElement('button');
      btn.className = 'zone-btn';
      btn.textContent = label;
      btn.style.left = (z.x / W * 100) + '%';
      btn.style.top = (z.y / H * 100) + '%';
      btn.style.width = (z.w / W * 100) + '%';
      btn.style.height = (z.h / H * 100) + '%';
      btn.addEventListener('click', () => selectZone(i, btn));
      zoneOverlay.appendChild(btn);
    });
  }

  function selectZone(i, btn) {
    if (locked) return;
    locked = true;
    selectedZone = i;
    [...zoneOverlay.children].forEach(b => b.classList.add('zone-disabled'));
    btn.classList.add('zone-picked');
    window.socket.emit('submit-choice', { zone: i });
    turnBanner.textContent = 'Choice locked in — waiting for opponent…';
  }

  window.socket?.on('opponent-ready', () => { /* could show a subtle indicator */ });

  window.socket?.on('kick-result', data => {
    lastResult = data;
    scores = data.scores;
    updateScoreboard();
    hide(zoneOverlay);
    turnBanner.textContent = data.scored ? 'GOAL!' : 'SAVED!';
    messageEl.textContent = data.scored ? 'GOAL!' : 'SAVED!';
    show(messageEl);
    render();
  });

  window.socket?.on('next-kick', data => {
    shooterIdx = data.shooterIndex;
    startTurn();
  });

  window.socket?.on('match-end', data => {
    hide(zoneOverlay);
    const iWon = data.winner === myIndex;
    turnBanner.textContent = iWon ? 'YOU WIN THE SHOOTOUT! 🏆' : 'You lost this shootout.';
    messageEl.textContent = `Final: ${data.scores[0]} - ${data.scores[1]}`;
    show(messageEl);
    show(rematchBtn);
  });

  rematchBtn.addEventListener('click', () => {
    window.socket.emit('rematch');
  });

  function updateScoreboard() {
    sbTitle.textContent = 'PENALTY SHOOTOUT';
    sbLeftLabel.textContent = (players[0]?.name || 'P1').slice(0, 10).toUpperCase();
    sbRightLabel.textContent = (players[1]?.name || 'P2').slice(0, 10).toUpperCase();
    scoreEl.textContent = scores[0];
    timeEl.textContent = scores[1];
  }

  function render() {
    if (window.currentMode !== 'online') return;
    ctx.fillStyle = '#1c6b1c';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    // goal frame
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeRect(GOAL_X, GOAL_Y, GOAL_W, GOAL_H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    for (let i = 1; i < 6; i++) {
      const gx = GOAL_X + (GOAL_W / 6) * i;
      ctx.beginPath(); ctx.moveTo(gx, GOAL_Y); ctx.lineTo(gx, GOAL_Y + GOAL_H); ctx.stroke();
    }

    // zone dividers (visual only)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(GOAL_X + GOAL_W / 2, GOAL_Y); ctx.lineTo(GOAL_X + GOAL_W / 2, GOAL_Y + GOAL_H);
    ctx.moveTo(GOAL_X, GOAL_Y + GOAL_H / 2); ctx.lineTo(GOAL_X + GOAL_W, GOAL_Y + GOAL_H / 2);
    ctx.stroke();

    // penalty spot + player figure
    const spotY = H - 150;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W / 2, spotY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2196f3';
    ctx.beginPath(); ctx.arc(W / 2, spotY - 30, 16, 0, Math.PI * 2); ctx.fill();

    // keeper + ball show result if we have one
    let keeperX = W / 2, saved = false, shotZone = null;
    if (lastResult) {
      shotZone = lastResult.shooterZone;
      keeperX = center(ZONE_RECTS[lastResult.keeperZone]).x;
      saved = !lastResult.scored;
    }
    const keeperY = GOAL_Y + 26;
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(keeperX - 23, keeperY - 10, 46, 20);
    ctx.fillStyle = '#212121';
    ctx.beginPath(); ctx.arc(keeperX, keeperY - 16, 7, 0, Math.PI * 2); ctx.fill();

    if (shotZone !== null) {
      const target = center(ZONE_RECTS[shotZone]);
      const ballY = saved ? keeperY + 4 : target.y;
      const ballX = saved ? keeperX : target.x;
      ctx.fillStyle = '#fafafa';
      ctx.beginPath(); ctx.arc(ballX, ballY, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#212121'; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      ctx.fillStyle = '#fafafa';
      ctx.beginPath(); ctx.arc(W / 2, spotY, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#212121'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  function center(z) { return { x: z.x + z.w / 2, y: z.y + z.h / 2 }; }
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function leave() {
    hide(zoneOverlay); hide(turnBanner); hide(rematchBtn);
    lastResult = null;
  }

  window.StadiumMultiplayer = { begin, leave };
})();
