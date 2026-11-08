const SVG_NS = 'http://www.w3.org/2000/svg';
const arena = document.getElementById('arena');
const ballSelect = document.getElementById('ballSelect');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

const levelDisplay = document.getElementById('levelDisplay');
const timeDisplay = document.getElementById('timeDisplay');
const hpDisplay = document.getElementById('hpDisplay');

const resultOverlay = document.getElementById('resultOverlay');
const resultTitle = document.getElementById('resultTitle');
const resultDesc = document.getElementById('resultDesc');
const restartBtn = document.getElementById('restartBtn');

const FIELD = 100;
const RADIUS = 7.5;
const BASE_SPEED = 40; // 速度翻倍

const BALLS = {
  common: { name: 'Common', init: () => 1, bounce: (dmg) => dmg },
  one_add: { name: 'OneAdd', init: () => 1, bounce: (dmg) => dmg + 1 },
  two_apart: { name: 'TwoApart', init: () => 1, bounce: (dmg) => dmg },
  pascal: { name: 'PascalTriangle', init: () => 1, bounce: (dmg) => dmg * 11 },
  billion_add: { name: 'BillionAdd', init: () => 1, bounce: (dmg) => dmg + 1e9 },
  double: { name: 'Double', init: () => 1, bounce: (dmg) => dmg * 2 },
  eating: { name: 'Eating', init: () => 10, bounce: (dmg) => dmg * 2 },
  random: { name: 'Random', init: () => Math.floor(Math.random() * 100) + 1, bounce: (dmg) => dmg },
  millecuple: { name: 'Millecuple', init: () => 1, bounce: (dmg) => dmg * 1000 },
  sqrt: { name: 'SquareRoot', init: () => 1, bounce: (dmg) => dmg },
  antimatter: { name: 'Antimatter', init: () => 1, bounce: (dmg) => dmg }
};

let levelsData = [];
let state = {
  status: 'idle', // idle, playing, paused, gameover
  levelIdx: 0,
  timeLeft: 20,
  ball: { x: 50, y: 50, vx: 0, vy: 0, speed: BASE_SPEED, dmg: 1 },
  wallHp: 0,
  wallHpStr: "",
  ballType: "common",
  lastTime: 0
};

function parseBigNum(str) {
  if (str.includes('(1e')) {
    return { isTower: true, str: str, lg: str.match(/1e\(1e(\d+)\)/)[1] };
  }
  if (str.includes('e')) {
    let parts = str.split('e');
    return { isSci: true, base: parseFloat(parts[0]), exp: parseInt(parts[1]) };
  }
  return { isSci: false, val: parseFloat(str) };
}

function reduceWallHp(ballType, wallHpObj) {
  if (wallHpObj.isTower) {
    if (ballType === 'sqrt') {
      let l = parseFloat(wallHpObj.lg);
      return { isSci: true, base: 1, exp: Math.floor(l / 2) - 1 };
    }
    if (ballType === 'two_apart') {
      let l = parseFloat(wallHpObj.lg);
      return { isSci: true, base: 1, exp: Math.floor(l / 2) - 1 };
    }
    return wallHpObj; 
  }

  let val = wallHpObj.isSci ? wallHpObj.base * Math.pow(10, wallHpObj.exp) : wallHpObj.val;
  
  if (ballType === 'two_apart') {
    val = Math.floor(val / 2) - 1;
  } else if (ballType === 'sqrt') {
    val = Math.floor(Math.sqrt(val)) - 1;
  } else {
    val -= state.ball.dmg;
  }

  if (val <= 0) return { isSci: false, val: 0 };
  
  if (val >= 1e5) {
    let exp = Math.floor(Math.log10(val));
    let base = val / Math.pow(10, exp);
    return { isSci: true, base: base, exp: exp };
  }
  return { isSci: false, val: val };
}

function formatHp(obj) {
  if (obj.isTower) return obj.str;
  if (obj.isSci) {
    if (obj.exp > 15) return `${obj.base.toFixed(2)}e${obj.exp}`;
    return (obj.base * Math.pow(10, obj.exp)).toExponential(2);
  }
  return Math.ceil(obj.val).toString();
}

async function init() {
  try {
    const res = await fetch('levels.json');
    levelsData = await res.json();
  } catch (e) {
    alert("Failed to load levels.json. Use a server.");
  }

  for (const key in BALLS) {
    ballSelect.add(new Option(BALLS[key].name, key));
  }

  startBtn.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', togglePause);
  resetBtn.addEventListener('click', resetToMenu);
  restartBtn.addEventListener('click', () => {
    resultOverlay.classList.add('hidden');
    startGame();
  });
}

function startGame() {
  state.ballType = ballSelect.value;
  state.levelIdx = 0;
  state.status = 'playing';
  resultOverlay.classList.add('hidden');
  
  // 随机方向初始化
  let angle = Math.random() * Math.PI * 2;
  state.ball = {
    x: 50, y: 50, 
    vx: Math.cos(angle) * BASE_SPEED,
    vy: Math.sin(angle) * BASE_SPEED,
    speed: BASE_SPEED,
    dmg: BALLS[state.ballType].init()
  };

  loadLevel();
  
  startBtn.style.display = 'none';
  pauseBtn.style.display = 'block';
  resetBtn.style.display = 'block';
  pauseBtn.textContent = 'Pause';
  pauseBtn.style.background = '#000';
  pauseBtn.style.color = '#FFF';

  state.lastTime = performance.now();
  requestAnimationFrame(loop);
}

function togglePause() {
  if (state.status === 'playing') {
    state.status = 'paused';
    pauseBtn.textContent = 'Resume';
    pauseBtn.style.background = '#FFF';
    pauseBtn.style.color = '#000';
  } else if (state.status === 'paused') {
    state.status = 'playing';
    pauseBtn.textContent = 'Pause';
    pauseBtn.style.background = '#000';
    pauseBtn.style.color = '#FFF';
    state.lastTime = performance.now(); // 防止时间跳跃
    requestAnimationFrame(loop);
  }
}

function resetToMenu() {
  state.status = 'idle';
  arena.innerHTML = '';
  resultOverlay.classList.add('hidden');
  
  startBtn.style.display = 'block';
  pauseBtn.style.display = 'none';
  resetBtn.style.display = 'none';
  
  levelDisplay.textContent = '1';
  timeDisplay.textContent = '20.0';
  hpDisplay.textContent = '-';
}

function loadLevel() {
  state.timeLeft = 20;
  let hpStr = levelsData[state.levelIdx];
  state.wallHp = parseBigNum(hpStr);
  state.wallHpStr = hpStr;

  levelDisplay.textContent = state.levelIdx + 1;
  hpDisplay.textContent = formatHp(state.wallHp);
  
  buildArena();
}

function buildArena() {
  arena.innerHTML = '';
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', 0); rect.setAttribute('y', 0);
  rect.setAttribute('width', 100); rect.setAttribute('height', 100);
  rect.setAttribute('fill', '#000'); rect.setAttribute('stroke', '#FFF');
  rect.setAttribute('stroke-width', '0.5');
  arena.appendChild(rect);

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('id', 'playerBall');
  circle.setAttribute('r', RADIUS);
  circle.setAttribute('fill', '#FFF');
  arena.appendChild(circle);
}

function loop(t) {
  if (state.status !== 'playing') return;
  
  let dt = (t - state.lastTime) / 1000;
  state.lastTime = t;
  if (dt > 0.05) dt = 0.05;

  state.timeLeft -= dt;
  timeDisplay.textContent = Math.max(0, state.timeLeft).toFixed(1);
  
  if (state.timeLeft <= 0) {
    gameOver("TIME UP", `You failed at level ${state.levelIdx + 1}.`);
    return;
  }

  let b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  let bounced = false;

  // 修复角落死锁：分别独立判断
  if (b.x < RADIUS) { b.x = RADIUS + 0.001; b.vx = Math.abs(b.vx); bounced = true; }
  if (b.x > FIELD - RADIUS) { b.x = FIELD - RADIUS - 0.001; b.vx = -Math.abs(b.vx); bounced = true; }
  if (b.y < RADIUS) { b.y = RADIUS + 0.001; b.vy = Math.abs(b.vy); bounced = true; }
  if (b.y > FIELD - RADIUS) { b.y = FIELD - RADIUS - 0.001; b.vy = -Math.abs(b.vy); bounced = true; }

  if (bounced) {
    handleBounce();
  }

  const ballEl = document.getElementById('playerBall');
  if (ballEl) {
    ballEl.setAttribute('cx', b.x);
    ballEl.setAttribute('cy', b.y);
  }

  requestAnimationFrame(loop);
}

function handleBounce() {
  let b = state.ball;
  
  state.wallHp = reduceWallHp(state.ballType, state.wallHp);
  
  let isDead = false;
  if (state.wallHp.isTower) { isDead = false; }
  else if (state.wallHp.isSci) { isDead = (state.wallHp.exp < 0 || state.wallHp.base <= 0); }
  else { isDead = (state.wallHp.val <= 0); }
  
  hpDisplay.textContent = formatHp(state.wallHp);

  if (isDead) {
    state.levelIdx++;
    if (state.levelIdx >= levelsData.length) {
      gameOver("VICTORY", "You cleared all levels!");
      return;
    }
    
    if (state.ballType === 'eating') {
      let prevLvlHpStr = levelsData[state.levelIdx - 1];
      let prevHp = parseBigNum(prevLvlHpStr);
      if (!prevHp.isTower) {
        let actualVal = prevHp.isSci ? prevHp.base * Math.pow(10, prevHp.exp) : prevHp.val;
        b.dmg += actualVal; 
      }
    }
    
    loadLevel();
    return;
  }

  const ballTypeDef = BALLS[state.ballType];
  if (ballTypeDef.bounce) {
    b.dmg = ballTypeDef.bounce(b.dmg);
  }

  if (state.ballType === 'antimatter') {
    b.speed /= 1000;
    let mag = Math.hypot(b.vx, b.vy);
    if (mag > 1e-6) {
      b.vx = (b.vx / mag) * b.speed;
      b.vy = (b.vy / mag) * b.speed;
    }
  }
}

function gameOver(title, desc) {
  state.status = 'gameover';
  resultTitle.textContent = title;
  resultDesc.textContent = desc;
  resultOverlay.classList.remove('hidden');
}

init();