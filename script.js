// ===== Stadium Striker — full original canvas football game, no images =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restartBtn');

// ---- goal is at the TOP of the field, player attacks upward ----
const GOAL_WIDTH = 150;
const GOAL_X = (W - GOAL_WIDTH) / 2;
const GOAL_Y = 30;
const PENALTY_Y = 190;

let score = 0;
let timeLeft = 90;
let gameOver = false;
let timerId = null;

// ---- player ----
const player = {
  x: W / 2, y: H - 120, r: 16,
  speed: 3.4,
  facing: { x: 0, y: -1 }
};

// ---- ball ----
const ball = {
  x: W / 2, y: H - 90, r: 9,
  vx: 0, vy: 0,
  friction: 0.985,
  attached: true
};

// ---- keeper ----
const keeper = {
  x: W / 2, y: GOAL_Y + 26, w: 46, h: 20,
  speed: 2.6
};

// ---- input ----
const keys = {};
let charging = false;
let chargeStart = 0;
const MAX_CHARGE = 650; // ms

function inputFocused() {
  const t = document.activeElement && document.activeElement.tagName;
  return t === 'INPUT' || t === 'TEXTAREA';
}
window.addEventListener('keydown', e => {
  if (inputFocused() || !soloStarted || gameOver) return;
  keys[e.key.toLowerCase()] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    startCharge();
  }
});
window.addEventListener('keyup', e => {
  if (inputFocused()) return;
  keys[e.key.toLowerCase()] = false;
  if (e.code === 'Space') {
    e.preventDefault();
    releaseCharge();
  }
});

function startCharge() {
  if (charging || gameOver) return;
  charging = true;
  chargeStart = performance.now();
}
function releaseCharge() {
  if (!charging) return;
  charging = false;
  const held = Math.min(performance.now() - chargeStart, MAX_CHARGE);
  kickBall(held / MAX_CHARGE);
}

function kickBall(power) {
  if (!ball.attached || gameOver) return;
  const minPower = 0.35;
  const p = minPower + power * (1 - minPower);
  const speed = 6 + p * 13;
  ball.vx = player.facing.x * speed;
  ball.vy = player.facing.y * speed;
  ball.attached = false;
}

// ---- touch / on-screen controls ----
const touchDirs = { up: false, down: false, left: false, right: false };
document.querySelectorAll('.dbtn').forEach(btn => {
  const dir = btn.dataset.dir;
  const set = v => e => { e.preventDefault(); touchDirs[dir] = v; };
  btn.addEventListener('touchstart', set(true), { passive: false });
  btn.addEventListener('touchend', set(false), { passive: false });
  btn.addEventListener('mousedown', set(true));
  btn.addEventListener('mouseup', set(false));
  btn.addEventListener('mouseleave', set(false));
});
const kickBtn = document.getElementById('kickBtn');
kickBtn.addEventListener('touchstart', e => { e.preventDefault(); startCharge(); }, { passive: false });
kickBtn.addEventListener('touchend', e => { e.preventDefault(); releaseCharge(); }, { passive: false });
kickBtn.addEventListener('mousedown', () => startCharge());
kickBtn.addEventListener('mouseup', () => releaseCharge());

restartBtn.addEventListener('click', resetMatch);

// ---- game loop ----
function update() {
  if (gameOver) return;

  let mx = 0, my = 0;
  if (keys['arrowup'] || keys['w'] || touchDirs.up) my -= 1;
  if (keys['arrowdown'] || keys['s'] || touchDirs.down) my += 1;
  if (keys['arrowleft'] || keys['a'] || touchDirs.left) mx -= 1;
  if (keys['arrowright'] || keys['d'] || touchDirs.right) mx += 1;

  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    player.x += mx * player.speed;
    player.y += my * player.speed;
    player.facing = { x: mx, y: my };
  }

  player.x = clamp(player.x, player.r, W - player.r);
  player.y = clamp(player.y, player.r, H - player.r);

  if (ball.attached) {
    ball.x = player.x + player.facing.x * 22;
    ball.y = player.y + player.facing.y * 22;
  } else {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= ball.friction;
    ball.vy *= ball.friction;

    // side walls bounce
    if (ball.x - ball.r < 6) { ball.x = 6 + ball.r; ball.vx *= -0.6; }
    if (ball.x + ball.r > W - 6) { ball.x = W - 6 - ball.r; ball.vx *= -0.6; }

    // reached goal line
    if (ball.y - ball.r <= GOAL_Y + 8) {
      const withinGoal = ball.x > GOAL_X + 6 && ball.x < GOAL_X + GOAL_WIDTH - 6;
      const keeperHit = Math.abs(ball.x - keeper.x) < keeper.w / 2 + ball.r &&
                         Math.abs(ball.y - keeper.y) < keeper.h / 2 + ball.r + 6;
      if (withinGoal && !keeperHit) {
        goalScored();
      } else {
        saveOrMiss(keeperHit);
      }
    }

    // ball stopped or went past bottom -> reset possession
    const slow = Math.hypot(ball.vx, ball.vy) < 0.05;
    if (slow || ball.y > H + 20) {
      resetBallToPlayer();
    }

    // player can reclaim a slow loose ball
    if (!ball.attached && Math.hypot(ball.x - player.x, ball.y - player.y) < player.r + ball.r + 4
        && Math.hypot(ball.vx, ball.vy) < 3) {
      ball.attached = true;
    }
  }

  // keeper AI: track ball x within its area, faster when ball is airborne toward goal
  const targetX = clamp(ball.x, GOAL_X + keeper.w / 2, GOAL_X + GOAL_WIDTH - keeper.w / 2);
  keeper.x += clamp(targetX - keeper.x, -keeper.speed, keeper.speed);
}

function saveOrMiss(saved) {
  showMessage(saved ? 'SAVED!' : 'MISSED!', 900);
  bounceBallBack();
}
function bounceBallBack() {
  ball.vy = Math.abs(ball.vy) * 0.5 + 1;
  ball.vx *= 0.4;
}
function goalScored() {
  score++;
  scoreEl.textContent = score;
  showMessage('GOAL!', 1100);
  setTimeout(resetPositions, 700);
}
function resetBallToPlayer() {
  ball.vx = 0; ball.vy = 0;
  ball.attached = true;
  ball.x = player.x; ball.y = player.y - 22;
}
function resetPositions() {
  player.x = W / 2; player.y = H - 120;
  player.facing = { x: 0, y: -1 };
  ball.attached = true;
  ball.vx = 0; ball.vy = 0;
  ball.x = player.x; ball.y = player.y - 22;
  keeper.x = W / 2;
}

function showMessage(text, duration) {
  messageEl.textContent = text;
  messageEl.classList.remove('hidden');
  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(() => messageEl.classList.add('hidden'), duration);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ---- drawing ----
function draw() {
  // pitch
  ctx.fillStyle = '#1c6b1c';
  ctx.fillRect(0, 0, W, H);

  // mowed stripes
  ctx.save();
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(0, i * (H / 10), W, H / 10);
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;

  // outer boundary
  ctx.strokeRect(6, 6, W - 12, H - 12);

  // halfway line + circle
  ctx.beginPath();
  ctx.moveTo(6, H / 2);
  ctx.lineTo(W - 6, H / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 55, 0, Math.PI * 2);
  ctx.stroke();

  // penalty box (top)
  ctx.strokeRect(W / 2 - 110, 6, 220, PENALTY_Y - 6);
  ctx.strokeRect(W / 2 - 55, 6, 110, 80);

  // penalty box (bottom, decorative)
  ctx.strokeRect(W / 2 - 110, H - 6 - (PENALTY_Y - 6), 220, PENALTY_Y - 6);

  // goal
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(GOAL_X, GOAL_Y - 14, GOAL_WIDTH, 14);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(GOAL_X, GOAL_Y - 14, GOAL_WIDTH, 14);
  // net lines
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i <= 8; i++) {
    const gx = GOAL_X + (GOAL_WIDTH / 8) * i;
    ctx.beginPath(); ctx.moveTo(gx, GOAL_Y - 14); ctx.lineTo(gx, GOAL_Y); ctx.stroke();
  }

  // keeper
  ctx.fillStyle = '#ffca28';
  roundRect(keeper.x - keeper.w / 2, keeper.y - keeper.h / 2, keeper.w, keeper.h, 6);
  ctx.fill();
  ctx.fillStyle = '#212121';
  ctx.beginPath();
  ctx.arc(keeper.x, keeper.y - keeper.h / 2 - 6, 7, 0, Math.PI * 2);
  ctx.fill();

  // charge meter
  if (charging) {
    const held = Math.min(performance.now() - chargeStart, MAX_CHARGE) / MAX_CHARGE;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(player.x - 25, player.y + 26, 50, 8);
    ctx.fillStyle = `hsl(${120 - held * 120},90%,50%)`;
    ctx.fillRect(player.x - 25, player.y + 26, 50 * held, 8);
  }

  // player
  ctx.fillStyle = '#2196f3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0d47a1';
  ctx.lineWidth = 2;
  ctx.stroke();
  // facing indicator
  ctx.strokeStyle = '#0d47a1';
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + player.facing.x * 22, player.y + player.facing.y * 22);
  ctx.stroke();

  // ball
  ctx.fillStyle = '#fafafa';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#212121';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ball.x - 4, ball.y);
  ctx.lineTo(ball.x + 4, ball.y);
  ctx.moveTo(ball.x, ball.y - 4);
  ctx.lineTo(ball.x, ball.y + 4);
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loop() {
  if (window.currentMode === 'solo') {
    update();
    draw();
  }
  requestAnimationFrame(loop);
}

// ---- timer / match flow ----
function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (gameOver) return;
    timeLeft--;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endMatch();
  }, 1000);
}

function endMatch() {
  gameOver = true;
  clearInterval(timerId);
  showMessage(`FULL TIME! Final Score: ${score}`, 999999);
  restartBtn.classList.remove('hidden');
}

function resetMatch() {
  score = 0; timeLeft = 90; gameOver = false;
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;
  restartBtn.classList.add('hidden');
  messageEl.classList.add('hidden');
  resetPositions();
  startTimer();
}

let soloStarted = false;
function startSoloGame() {
  resetMatch();
  if (!soloStarted) { soloStarted = true; loop(); }
}
function stopSoloGame() {
  gameOver = true;
  clearInterval(timerId);
}
window.StadiumSolo = { start: startSoloGame, stop: stopSoloGame };
