(() => {
  const canvas = document.getElementById("waves");
  if (!canvas) { console.error("[Waves] canvas #waves not found"); return; }
  const ctx = canvas.getContext("2d", { alpha: true });

  const cfg = {
    stroke: "#ff4c15",
    lineWidth: 1.25,
    stepPx: 2,

    centerY: 0.52,
    microOffsetPx: 6,

    // Base (tu look)
    baseFreq: 0.85,
    baseSpeed: 0.22,
    ampBase: 0.14,
    breatheSpeed: 0.35,
    breatheAmount: 0.60,

    // ===== Hover “orgánico” (nuevo) =====
    hoverAmpBoost: 0.55,     // cuánto sube la amplitud global al hover (0..1)
    hoverBreatheBoost: 0.35, // cuánto se “respira” más al hover
    lensRadiusPx: 220,       // radio del “lens” alrededor del cursor
    lensStrength: 1.25,      // cuánto se abre la onda localmente
    phaseRippleAmt: 0.55,    // cuánto se “mueve” la fase localmente (orgánico)
    phaseRippleFreq: 0.020,  // frecuencia espacial del ripple
    phaseRippleSpeed: 1.10,  // velocidad del ripple (suave)
    hoverEase: 0.08,         // suavizado entrada/salida (0.05–0.12)
    idleWobble: 0.10         // micro vida incluso sin hover (muy leve)
  };

  const lines = [
    { phase: 0.0,  alpha: 0.95, mo: -1, ampMul: 1.05, speedMul: 1.00 },
    { phase: 2.1,  alpha: 0.80, mo:  0, ampMul: 0.85, speedMul: 0.86 },
    { phase: 4.2,  alpha: 0.70, mo:  1, ampMul: 1.15, speedMul: 0.72 }
  ];

  let t0 = performance.now();

  // Hover state
  let pointer = { x: 0, y: 0, inside: false };
  let hover = 0; // 0..1 (smoothed)
  let targetHover = 0;

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = (e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0) - r.left;
    pointer.y = (e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0) - r.top;
  }
  function onEnter() { pointer.inside = true; targetHover = 1; }
  function onLeave() { pointer.inside = false; targetHover = 0; }

  canvas.addEventListener("mousemove", onMove, { passive: true });
  canvas.addEventListener("mouseenter", onEnter, { passive: true });
  canvas.addEventListener("mouseleave", onLeave, { passive: true });
  canvas.addEventListener("touchmove", (e) => { onEnter(); onMove(e); }, { passive: true });
  canvas.addEventListener("touchend", onLeave, { passive: true });
  canvas.addEventListener("touchcancel", onLeave, { passive: true });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Gaussian falloff helper (lens)
  function gauss(x, sigma) {
    const s2 = sigma * sigma;
    return Math.exp(-(x * x) / (2 * s2));
  }

  function drawLine(line, t, w, h, i) {
    const yBase = h * cfg.centerY + line.mo * cfg.microOffsetPx;

    // amplitud base en px
    const A0 = h * cfg.ampBase * line.ampMul;

    // breathing base (tuya)
    const breatheBase = 1 + Math.sin(t * cfg.breatheSpeed + line.phase) * cfg.breatheAmount;

    // hover: sube un poco la amplitud global y el breathing (suave)
    const hoverAmp = 1 + hover * cfg.hoverAmpBoost;
    const breatheHover = 1 + hover * cfg.hoverBreatheBoost;

    // micro vida incluso en idle (muy leve, para que no parezca “plano”)
    const micro = 1 + Math.sin(t * 0.7 + line.phase * 1.3) * cfg.idleWobble * 0.08;

    const A = A0 * breatheBase * hoverAmp * micro * breatheHover;

    // misma frecuencia base para todas => cruces
    const k = (Math.PI * 2 * cfg.baseFreq) / w;
    const speed = cfg.baseSpeed * line.speedMul;

    // lens params
    const sigma = cfg.lensRadiusPx; // px
    const px = pointer.x || (w * 0.5);

    ctx.globalAlpha = line.alpha;
    ctx.beginPath();

    for (let x = -30; x <= w + 30; x += cfg.stepPx) {
      // Lens falloff (0..1) alrededor del cursor
      const d = x - px;
      const lens = hover * gauss(d, sigma);

      // 1) amplificación local: la onda se “abre” cerca del cursor
      const localAmp = 1 + lens * cfg.lensStrength;

      // 2) perturbación de fase suave: da orgánico sin ensuciar la forma
      //    (no es otra onda sumada, es mover la fase localmente)
      const ripple =
        lens *
        cfg.phaseRippleAmt *
        Math.sin(d * cfg.phaseRippleFreq - t * cfg.phaseRippleSpeed + line.phase * 0.7);

      // Onda limpia
      const y = yBase + Math.sin(x * k + t * speed + line.phase + ripple) * (A * localAmp);

      if (x === -30) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  }

  function frame(now) {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (w < 2 || h < 2) { requestAnimationFrame(frame); return; }

    const t = (now - t0) / 1000;

    // smooth hover
    hover += (targetHover - hover) * cfg.hoverEase;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = cfg.stroke;
    ctx.lineWidth = cfg.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    drawLine(lines[0], t, w, h, 0);
    drawLine(lines[1], t, w, h, 1);
    drawLine(lines[2], t, w, h, 2);

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  requestAnimationFrame(frame);
})();
