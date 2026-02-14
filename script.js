(() => {
  "use strict";

  const MAX_LIVES = 3;
  const START_SPAWN_DELAY = 900;
  const MIN_SPAWN_DELAY = 260;

  const ui = {
    score: document.getElementById("scoreValue"),
    highScore: document.getElementById("highScoreValue"),
    combo: document.getElementById("comboValue"),
    power: document.getElementById("powerValue"),
    lives: document.getElementById("livesValue"),
    startBtn: document.getElementById("startBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    soundBtn: document.getElementById("soundBtn"),
    musicBtn: document.getElementById("musicBtn"),
    themeBtn: document.getElementById("themeBtn"),
    overlayStartBtn: document.getElementById("overlayStartBtn"),
    restartBtn: document.getElementById("restartBtn"),
    resumeBtn: document.getElementById("resumeBtn"),
    startScreen: document.getElementById("startScreen"),
    pauseScreen: document.getElementById("pauseScreen"),
    gameOverScreen: document.getElementById("gameOverScreen"),
    finalScore: document.getElementById("finalScoreValue"),
    finalBest: document.getElementById("finalBestValue")
  };

  const canvas = document.getElementById("gameCanvas");
  const canvasWrap = document.getElementById("canvasWrap");
  const ctx = canvas.getContext("2d", { alpha: true });

  const state = {
    width: 0,
    height: 0,
    running: false,
    paused: false,
    gameOver: false,
    lastTime: 0,
    rafId: 0,
    elapsed: 0,
    spawnClock: 0,
    spawnDelay: START_SPAWN_DELAY,
    baseFallSpeed: 150,
    score: 0,
    highScore: Number(localStorage.getItem("fruitCatcherHighScore") || 0),
    combo: 0,
    lives: MAX_LIVES,
    soundEnabled: true,
    musicEnabled: true,
    doubleScoreMs: 0,
    slowMotionMs: 0,
    cachedHUD: {
      score: null,
      highScore: null,
      combo: null,
      power: null,
      lives: null
    }
  };

  const basket = {
    x: 0,
    y: 0,
    width: 104,
    height: 54,
    speed: 560
  };

  const input = {
    left: false,
    right: false,
    pointerDown: false
  };

  const fruits = [];
  const particles = [];

  const images = {};
  const imageSources = {
    basket: "assets/images/basket.png",
    apple: "assets/images/apple.png",
    banana: "assets/images/banana.png",
    orange: "assets/images/orange.png",
    strawberry: "assets/images/strawberry.png",
    heart: "assets/images/heart.png",
    background: "assets/images/background.png"
  };

  const fruitTypes = [
    { id: "apple", score: 10, color: "#ff5b5b", radius: 20, weight: 0.29 },
    { id: "banana", score: 8, color: "#ffd756", radius: 20, weight: 0.29 },
    { id: "orange", score: 12, color: "#ff9f43", radius: 20, weight: 0.24 },
    { id: "strawberry", score: 15, color: "#ff4f84", radius: 19, weight: 0.18 }
  ];

  const powerTypes = [
    { id: "slow", color: "#52b6ff", radius: 18, duration: 6000, label: "SLOW" },
    { id: "double", color: "#f2c84b", radius: 18, duration: 7500, label: "2X" }
  ];

  const audioCtx = window.AudioContext ? new AudioContext() : null;

  const musicTrack = new Audio("assets/sounds/music.mp3");
  musicTrack.loop = true;
  musicTrack.volume = 0.22;

  const sfxPools = {
    catch: createSoundPool("assets/sounds/catch.mp3", 0.42, 4),
    miss: createSoundPool("assets/sounds/miss.mp3", 0.55, 3),
    gameover: createSoundPool("assets/sounds/gameover.mp3", 0.58, 2)
  };

  function createSoundPool(src, volume, count) {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.preload = "auto";
      list.push(audio);
    }
    return { list, index: 0 };
  }

  function playPool(name, fallbackFreq) {
    if (!state.soundEnabled) {
      return;
    }
    const pool = sfxPools[name];
    if (!pool || pool.list.length === 0) {
      playTone(fallbackFreq, 0.07, "sine");
      return;
    }

    const sound = pool.list[pool.index];
    pool.index = (pool.index + 1) % pool.list.length;
    try {
      sound.currentTime = 0;
      sound.play().catch(() => playTone(fallbackFreq, 0.07, "triangle"));
    } catch (_err) {
      playTone(fallbackFreq, 0.07, "triangle");
    }
  }

  function playTone(freq, duration, type) {
    if (!state.soundEnabled || !audioCtx) {
      return;
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gainNode.gain.value = 0.001;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }

  function syncMusicState() {
    if (!state.musicEnabled || !state.running || state.paused || state.gameOver) {
      musicTrack.pause();
      return;
    }
    musicTrack.play().catch(() => {});
  }

  function showOverlay(el) {
    [ui.startScreen, ui.pauseScreen, ui.gameOverScreen].forEach((node) => {
      node.classList.add("hidden");
      node.classList.remove("active");
    });
    if (el) {
      el.classList.remove("hidden");
      el.classList.add("active");
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createImage(src) {
    const image = new Image();
    image.src = src;
    return image;
  }

  function preloadImages() {
    Object.entries(imageSources).forEach(([key, src]) => {
      images[key] = createImage(src);
    });
  }

  function isUsableImage(img) {
    return Boolean(img && img.complete && img.naturalWidth > 1 && img.naturalHeight > 1);
  }

  function weightedFruitType() {
    const totalWeight = fruitTypes.reduce((sum, item) => sum + item.weight, 0);
    let randomValue = Math.random() * totalWeight;
    for (let i = 0; i < fruitTypes.length; i += 1) {
      randomValue -= fruitTypes[i].weight;
      if (randomValue <= 0) {
        return fruitTypes[i];
      }
    }
    return fruitTypes[fruitTypes.length - 1];
  }

  function spawnFruit() {
    const difficultyScale = 1 + state.elapsed * 0.075;
    const chance = Math.min(0.18, 0.07 + state.elapsed * 0.004);
    let entity;

    if (Math.random() < chance) {
      const power = powerTypes[Math.floor(Math.random() * powerTypes.length)];
      entity = {
        kind: "power",
        type: power.id,
        label: power.label,
        color: power.color,
        radius: power.radius,
        duration: power.duration,
        x: Math.random() * (state.width - power.radius * 2) + power.radius,
        y: -40,
        speed: (state.baseFallSpeed + 70 + Math.random() * 90) * (0.8 + difficultyScale * 0.1),
        rotation: 0,
        spin: (Math.random() * 2 - 1) * 2.3
      };
    } else {
      const fruit = weightedFruitType();
      entity = {
        kind: "fruit",
        type: fruit.id,
        baseScore: fruit.score,
        color: fruit.color,
        radius: fruit.radius,
        x: Math.random() * (state.width - fruit.radius * 2) + fruit.radius,
        y: -45,
        speed: (state.baseFallSpeed + Math.random() * 120) * difficultyScale,
        rotation: 0,
        spin: (Math.random() * 2 - 1) * 2.5
      };
    }
    fruits.push(entity);
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 14; i += 1) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 280,
        vy: (Math.random() - 0.8) * 220,
        life: 0.6 + Math.random() * 0.35,
        maxLife: 0.6 + Math.random() * 0.35,
        size: 2 + Math.random() * 4,
        color
      });
    }
  }

  function circleRectCollision(circle, rect) {
    const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
    const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
    const dx = circle.x - nearestX;
    const dy = circle.y - nearestY;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
  }

  function drawRoundedRect(x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  function catchFruit(entity) {
    if (entity.kind === "fruit") {
      state.combo += 1;
      const comboBonus = Math.max(0, Math.floor((state.combo - 1) / 3) * 4);
      let points = entity.baseScore + comboBonus;
      if (state.doubleScoreMs > 0) {
        points *= 2;
      }
      state.score += points;
      playPool("catch", 860);
    } else {
      state.score += state.doubleScoreMs > 0 ? 40 : 20;
      state.combo += 1;
      if (entity.type === "slow") {
        state.slowMotionMs = entity.duration;
      }
      if (entity.type === "double") {
        state.doubleScoreMs = entity.duration;
      }
      playTone(1040, 0.12, "square");
    }

    spawnParticles(entity.x, entity.y, entity.color);
    refreshHUD();
  }

  function missFruit(entity) {
    if (entity.kind !== "fruit") {
      return;
    }
    state.combo = 0;
    state.lives -= 1;
    playPool("miss", 220);
    refreshHUD();

    if (state.lives <= 0) {
      endGame();
    }
  }

  function endGame() {
    state.gameOver = true;
    state.running = false;
    ui.pauseBtn.disabled = true;
    ui.pauseBtn.textContent = "Pause";

    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem("fruitCatcherHighScore", String(state.highScore));
    }

    ui.finalScore.textContent = String(state.score);
    ui.finalBest.textContent = String(state.highScore);
    playPool("gameover", 140);
    syncMusicState();
    showOverlay(ui.gameOverScreen);
    refreshHUD(true);
  }

  function setPaused(nextPaused) {
    if (state.gameOver || !state.running) {
      return;
    }
    state.paused = nextPaused;
    ui.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    showOverlay(state.paused ? ui.pauseScreen : null);
    syncMusicState();
  }

  function resetGameState() {
    state.elapsed = 0;
    state.spawnClock = 0;
    state.spawnDelay = START_SPAWN_DELAY;
    state.baseFallSpeed = 150;
    state.score = 0;
    state.combo = 0;
    state.lives = MAX_LIVES;
    state.doubleScoreMs = 0;
    state.slowMotionMs = 0;
    state.paused = false;
    state.gameOver = false;
    state.running = true;

    basket.width = Math.max(70, state.width * 0.11);
    basket.height = basket.width * 0.5;
    basket.x = state.width / 2 - basket.width / 2;
    basket.y = state.height - basket.height - 14;

    fruits.length = 0;
    particles.length = 0;
    ui.pauseBtn.disabled = false;
    ui.pauseBtn.textContent = "Pause";

    refreshHUD(true);
    showOverlay(null);
    syncMusicState();
  }

  function startGame() {
    resetGameState();
    state.lastTime = performance.now();
    if (!state.rafId) {
      state.rafId = requestAnimationFrame(loop);
    }
  }

  function update(dt) {
    const slowFactor = state.slowMotionMs > 0 ? 0.62 : 1;
    const effectiveDt = dt * slowFactor;

    state.elapsed += dt;
    state.spawnDelay = Math.max(MIN_SPAWN_DELAY, START_SPAWN_DELAY - state.elapsed * 30);
    state.baseFallSpeed = 150 + state.elapsed * 11;

    if (state.doubleScoreMs > 0) {
      state.doubleScoreMs = Math.max(0, state.doubleScoreMs - dt * 1000);
    }
    if (state.slowMotionMs > 0) {
      state.slowMotionMs = Math.max(0, state.slowMotionMs - dt * 1000);
    }

    const direction = Number(input.right) - Number(input.left);
    if (direction !== 0) {
      basket.x += direction * basket.speed * effectiveDt;
      basket.x = clamp(basket.x, 0, state.width - basket.width);
    }

    state.spawnClock += dt * 1000;
    while (state.spawnClock >= state.spawnDelay) {
      state.spawnClock -= state.spawnDelay;
      spawnFruit();
    }

    for (let i = fruits.length - 1; i >= 0; i -= 1) {
      const item = fruits[i];
      item.y += item.speed * effectiveDt;
      item.rotation += item.spin * effectiveDt;

      if (circleRectCollision(item, basket)) {
        catchFruit(item);
        fruits.splice(i, 1);
        continue;
      }

      if (item.y - item.radius > state.height) {
        missFruit(item);
        fruits.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }

    refreshHUD();
  }

  function drawBackground() {
    const rootStyle = getComputedStyle(document.documentElement);
    const top = rootStyle.getPropertyValue("--bg-1").trim() || "#fff1bf";
    const bottom = rootStyle.getPropertyValue("--bg-3").trim() || "#ffb3a7";

    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    if (isUsableImage(images.background)) {
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.drawImage(images.background, 0, 0, state.width, state.height);
      ctx.restore();
    }

    const t = performance.now() * 0.001;
    for (let i = 0; i < 6; i += 1) {
      const x = ((i * 173 + t * 35) % (state.width + 140)) - 70;
      const y = 40 + i * 70 + Math.sin(t + i) * 12;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(x, y, 20 + (i % 3) * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBasket() {
    if (isUsableImage(images.basket)) {
      ctx.drawImage(images.basket, basket.x, basket.y, basket.width, basket.height);
      return;
    }

    const gradient = ctx.createLinearGradient(basket.x, basket.y, basket.x, basket.y + basket.height);
    gradient.addColorStop(0, "#bf7c32");
    gradient.addColorStop(1, "#8c4f1a");
    ctx.fillStyle = gradient;
    drawRoundedRect(basket.x, basket.y, basket.width, basket.height, 14);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(basket.x + basket.width / 2, basket.y + 2, basket.width * 0.32, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  function drawFruit(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);

    if (item.kind === "fruit" && isUsableImage(images[item.type])) {
      const size = item.radius * 2.1;
      ctx.drawImage(images[item.type], -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (item.kind === "power") {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "bold 12px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, 0, 1);
      ctx.restore();
      return;
    }

    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(-item.radius * 0.32, -item.radius * 0.36, item.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#2d803d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -item.radius + 2);
    ctx.lineTo(0, -item.radius - 8);
    ctx.stroke();

    ctx.restore();
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = `${p.color}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStatusText() {
    if (!state.running && !state.gameOver) {
      return;
    }

    if (state.slowMotionMs > 0 || state.doubleScoreMs > 0) {
      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(17, 33, 56, 0.8)";
      ctx.font = "bold 16px Trebuchet MS";
      let lineY = 12;
      if (state.doubleScoreMs > 0) {
        ctx.fillText(`Double Score ${Math.ceil(state.doubleScoreMs / 1000)}s`, 12, lineY);
        lineY += 20;
      }
      if (state.slowMotionMs > 0) {
        ctx.fillText(`Slow Motion ${Math.ceil(state.slowMotionMs / 1000)}s`, 12, lineY);
      }
      ctx.restore();
    }
  }

  function render() {
    ctx.clearRect(0, 0, state.width, state.height);
    drawBackground();

    for (let i = 0; i < fruits.length; i += 1) {
      drawFruit(fruits[i]);
    }

    drawBasket();
    drawParticles();
    drawStatusText();
  }

  function loop(timestamp) {
    const dt = Math.min(0.05, (timestamp - state.lastTime) / 1000 || 0.016);
    state.lastTime = timestamp;

    if (state.running && !state.paused && !state.gameOver) {
      update(dt);
    }

    render();
    state.rafId = requestAnimationFrame(loop);
  }

  function refreshHUD(force = false) {
    if (force || state.cachedHUD.score !== state.score) {
      state.cachedHUD.score = state.score;
      ui.score.textContent = String(state.score);
    }

    if (force || state.cachedHUD.highScore !== state.highScore) {
      state.cachedHUD.highScore = state.highScore;
      ui.highScore.textContent = String(state.highScore);
    }

    const comboText = `${Math.max(1, state.combo)}x`;
    if (force || state.cachedHUD.combo !== comboText) {
      state.cachedHUD.combo = comboText;
      ui.combo.textContent = comboText;
    }

    const powers = [];
    if (state.doubleScoreMs > 0) {
      powers.push(`2X ${Math.ceil(state.doubleScoreMs / 1000)}s`);
    }
    if (state.slowMotionMs > 0) {
      powers.push(`SLOW ${Math.ceil(state.slowMotionMs / 1000)}s`);
    }
    const powerText = powers.length ? powers.join(" | ") : "None";

    if (force || state.cachedHUD.power !== powerText) {
      state.cachedHUD.power = powerText;
      ui.power.textContent = powerText;
    }

    if (force || state.cachedHUD.lives !== state.lives) {
      state.cachedHUD.lives = state.lives;
      ui.lives.innerHTML = "";
      for (let i = 0; i < MAX_LIVES; i += 1) {
        const heart = document.createElement("span");
        heart.className = i < state.lives ? "heart" : "heart off";
        heart.innerHTML = "&#10084;";
        ui.lives.appendChild(heart);
      }
    }
  }

  function resizeCanvas() {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.width = rect.width;
    state.height = rect.height;

    basket.width = Math.max(70, state.width * 0.11);
    basket.height = basket.width * 0.5;
    basket.y = state.height - basket.height - 14;
    basket.x = clamp(basket.x, 0, Math.max(0, state.width - basket.width));
  }

  function updateSoundButtons() {
    ui.soundBtn.textContent = `SFX: ${state.soundEnabled ? "On" : "Off"}`;
    ui.musicBtn.textContent = `Music: ${state.musicEnabled ? "On" : "Off"}`;
  }

  function applyTheme(theme) {
    const finalTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", finalTheme);
    localStorage.setItem("fruitCatcherTheme", finalTheme);
    ui.themeBtn.textContent = `Theme: ${finalTheme === "dark" ? "Light" : "Dark"}`;
  }

  function pointerToCanvasX(event) {
    const rect = canvas.getBoundingClientRect();
    return clamp(event.clientX - rect.left, 0, rect.width);
  }

  function handlePointerMove(event) {
    if (!input.pointerDown || !state.running || state.paused || state.gameOver) {
      return;
    }
    const x = pointerToCanvasX(event);
    basket.x = clamp(x - basket.width / 2, 0, state.width - basket.width);
  }

  function bindEvents() {
    ui.startBtn.addEventListener("click", startGame);
    ui.overlayStartBtn.addEventListener("click", startGame);
    ui.restartBtn.addEventListener("click", startGame);
    ui.resumeBtn.addEventListener("click", () => setPaused(false));

    ui.pauseBtn.addEventListener("click", () => {
      setPaused(!state.paused);
    });

    ui.soundBtn.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      updateSoundButtons();
    });

    ui.musicBtn.addEventListener("click", () => {
      state.musicEnabled = !state.musicEnabled;
      updateSoundButtons();
      syncMusicState();
    });

    ui.themeBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();

      if (key === "arrowleft" || key === "a") {
        input.left = true;
        event.preventDefault();
      }
      if (key === "arrowright" || key === "d") {
        input.right = true;
        event.preventDefault();
      }
      if (key === "p" || key === "escape") {
        if (state.running && !state.gameOver) {
          setPaused(!state.paused);
          event.preventDefault();
        }
      }
      if ((key === "enter" || key === " ") && !state.running && !state.gameOver) {
        startGame();
        event.preventDefault();
      }
      if ((key === "enter" || key === " ") && state.gameOver) {
        startGame();
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        input.left = false;
      }
      if (key === "arrowright" || key === "d") {
        input.right = false;
      }
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (!state.running || state.paused || state.gameOver) {
        return;
      }
      input.pointerDown = true;
      canvas.setPointerCapture(event.pointerId);
      handlePointerMove(event);
    });

    canvas.addEventListener("pointermove", handlePointerMove);

    canvas.addEventListener("pointerup", () => {
      input.pointerDown = false;
    });

    canvas.addEventListener("pointercancel", () => {
      input.pointerDown = false;
    });

    window.addEventListener("resize", resizeCanvas);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.running && !state.gameOver) {
        setPaused(true);
      }
    });
  }

  function init() {
    preloadImages();
    bindEvents();
    resizeCanvas();

    const savedTheme = localStorage.getItem("fruitCatcherTheme") || "light";
    applyTheme(savedTheme);

    refreshHUD(true);
    updateSoundButtons();
    showOverlay(ui.startScreen);

    state.lastTime = performance.now();
    state.rafId = requestAnimationFrame(loop);
  }

  init();
})();