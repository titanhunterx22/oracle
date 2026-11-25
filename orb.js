/* ORACLE orb + ambient particles. */
(function (g) {
  'use strict';
  const O = (g.ORACLE = g.ORACLE || {});
  let timer = 0;
  O.orb = {
    html: (cls) => `<div class="orb ${cls || ''}" data-state="idle" aria-hidden="true"><span class="glow"></span><span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span><span class="wave"></span><span class="wave w2"></span><span class="core"></span><span class="scan"></span></div>`,
    set(state, holdMs) {
      document.querySelectorAll('.orb').forEach(o => { o.dataset.state = state; });
      document.querySelectorAll('[data-orb-label]').forEach(l => { l.textContent = ({ idle: 'Idle', processing: 'Processing…', analysing: 'Analysing…', responding: 'Responding', error: 'Needs attention' })[state] || state; l.dataset.state = state; });
      clearTimeout(timer); if (holdMs) timer = setTimeout(() => O.orb.set('idle'), holdMs);
    },
    boot() { document.querySelectorAll('.orb').forEach(o => { o.classList.add('boot'); setTimeout(() => o.classList.remove('boot'), 1200); }); }
  };
  O.particles = {
    start(canvas, enabled) {
      if (!canvas || !enabled || matchMedia('(prefers-reduced-motion: reduce)').matches) { if (canvas) canvas.style.display = 'none'; return; }
      const ctx = canvas.getContext('2d'); let w, h, raf; const N = 38;
      const ps = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + .4, vx: (Math.random() - .5) * .00012, vy: -Math.random() * .00018 - .00005, c: Math.random() < .5 ? '139,92,246' : '34,211,238', a: Math.random() * .5 + .15 }));
      const size = () => { w = canvas.width = canvas.clientWidth * devicePixelRatio; h = canvas.height = canvas.clientHeight * devicePixelRatio; };
      size(); addEventListener('resize', size);
      const frame = () => {
        ctx.clearRect(0, 0, w, h);
        for (const p of ps) { p.x += p.vx; p.y += p.vy; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); } if (p.x < 0 || p.x > 1) p.vx *= -1; ctx.beginPath(); ctx.fillStyle = `rgba(${p.c},${p.a})`; ctx.arc(p.x * w, p.y * h, p.r * devicePixelRatio, 0, 6.283); ctx.fill(); }
        raf = requestAnimationFrame(frame);
      };
      document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else frame(); });
      frame();
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
