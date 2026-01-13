(() => {
  const canvas = document.getElementById("waves");
  const wrap = document.querySelector(".wave_wrapper");
  if (!canvas || !wrap) {
    console.log("[waves] missing elements", { canvas: !!canvas, wrap: !!wrap });
    return;
  }

  // Avoid double init
  if (canvas.dataset.init === "1") return;
  canvas.dataset.init = "1";

  const ctx = canvas.getContext("2d", { alpha: true });

  const SETTINGS = {
    lines: 3,

    // subtle base
    baseAmp: 5,
    baseSpeed: 0.30,
    baseFreq: 0.010,

    // pronounced on hover
    hoverAmp: 90,
    hoverRadius: 220,

    coupling: 0.30,
    samples: 260,
    lineWidth: 2,

    color: "rgba(255,255,255,0.85)",
    bg: "transparent",

    breatheAmp: 0.35,
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  let pointer = { x: 0, y: 0, inside: false };

  function updatePointer(e) {
    const r = wrap.getBoundingClientRect();
    const cx = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX) ?? 0;
    const cy = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY) ?? 0;

    const x = cx - r.left;
    const y = cy - r.top;

    pointer.x = x;
    pointer.y = y;
    pointer.inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
  }

  wrap.addEventListener("mousemove", updatePointer, { passive: true });
  wrap.addEventListener("touchmove", updatePointer, { passive: true });
  wrap.addEventListener("mouseleave", () => { pointer.inside = false; }, { passive: true });

  window.addEventListener("resize", resize, { passive: true });
  resize();

  const energy = new Array(SETTINGS.lines).fill(0);
  const energyVel = new Array(SETTINGS.lines).fill(0);

  const phase = Array.from({ length: SETTINGS.lines }, (_, i) => Math.random() * Math.PI * 2 + i * 0.9);
  const freqJitter = Array.from({ length: SETTINGS.lines }, () => 0.85 + Math.random() * 0.45);

  let t0 = performance.now();

  function draw(now) {
    const dt = Math.min(0.033, (now - t0) / 1000);
    t0 = now;

    const rect = wrap.getBoundingClientRect();
    const W = Math.max(1, rect.width);
    const H = Math.max(1, rect.height);

    if (SETTINGS.bg !== "transparent") {
      ctx.fillStyle = SETTINGS.bg;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }

    // positions
    const topPad = H * 0.30;
    const gap = (H - topPad * 2) / (SETTINGS.lines - 1 || 1);

    // targets
    const target = new Array(SETTINGS.lines).fill(0);
    for (let i = 0; i < SETTINGS.lines; i++) {
      const yLine = topPad + gap * i;
      if (!pointer.inside) { target[i] = 0; continue; }

      const dy = Math.abs(pointer.y - yLine);
      const dx = Math.abs(pointer.x - W * 0.5);
      const dist = Math.sqrt(dy * dy + (dx * 0.35) * (dx * 0.35));
      const n = 1 - Math.min(1, dist / SETTINGS.hoverRadius);
      target[i] = n * n;
    }

    // coupling
    for (let i = 0; i < SETTINGS.lines; i++) {
      const left = i > 0 ? energy[i - 1] : energy[i];
      const right = i < SETTINGS.lines - 1 ? energy[i + 1] : energy[i];
      const neighborMean = (left + right) * 0.5;

      const coupledTarget = lerp(target[i], neighborMean, SETTINGS.coupling);

      const accel = (coupledTarget - energy[i]) * 8.0;
      energyVel[i] += accel * dt;
      energyVel[i] *= 0.86;
      energy[i] += energyVel[i];
      energy[i] = clamp01(energy[i]);
    }

    // draw lines
    ctx.strokeStyle = SETTINGS.color;
    ctx.lineWidth = SETTINGS.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const breathe = 0.65 + 0.35 * Math.sin(now * 0.00055);

    for (let i = 0; i < SETTINGS.lines; i++) {
      const yLine = topPad + gap * i;
      const amp = SETTINGS.baseAmp * (1 + SETTINGS.breatheAmp * breathe) + SETTINGS.hoverAmp * energy[i];
      const freq = SETTINGS.baseFreq * freqJitter[i];
      phase[i] += dt * SETTINGS.baseSpeed * (1.0 + energy[i] * 0.9);

      ctx.beginPath();
      for (let s = 0; s <= SETTINGS.samples; s++) {
        const x = (s / SETTINGS.samples) * W;

        // local boost near cursor
        let localBoost = 1;
        if (pointer.inside) {
          const d = Math.abs(x - pointer.x);
          const m = 1 - Math.min(1, d / (SETTINGS.hoverRadius * 1.15));
          localBoost = 1 + 0.95 * (m * m) * energy[i];
        }

        const y = yLine + Math.sin(x * freq + phase[i]) * amp * localBoost;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  console.log("[waves] init ok", {
    wrapper: wrap.className,
    size: wrap.getBoundingClientRect()
  });

  requestAnimationFrame(draw);
})();

