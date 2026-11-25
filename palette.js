/* ORACLE command palette. Self-contained (shadow DOM) so it works in pages, the popup and the dashboard. */
(function (g) {
  'use strict';
  const O = (g.ORACLE = g.ORACLE || {});
  const CSS = `
  :host{all:initial}
  .ov{position:fixed;inset:0;z-index:2147483647;background:rgba(3,4,12,.55);backdrop-filter:blur(3px);display:flex;justify-content:center;align-items:flex-start;padding-top:12vh;font:14px/1.4 "Segoe UI Variable","Segoe UI",system-ui,sans-serif}
  .box{width:min(560px,92vw);background:rgba(12,15,34,.96);border:1px solid rgba(150,140,255,.35);border-radius:14px;box-shadow:0 20px 80px rgba(110,80,255,.35);overflow:hidden;color:#e8eaf6;animation:in .16s ease-out}
  @keyframes in{from{opacity:0;transform:translateY(-8px) scale(.98)}}
  input{width:100%;box-sizing:border-box;background:transparent;border:0;border-bottom:1px solid rgba(150,140,255,.2);color:#fff;font:inherit;font-size:16px;padding:16px 18px;outline:none}
  ul{list-style:none;margin:0;padding:6px;max-height:340px;overflow:auto}
  li{padding:10px 12px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;gap:12px}
  li small{color:#8b90b3}
  li.sel{background:linear-gradient(90deg,rgba(139,92,246,.35),rgba(34,211,238,.18))}
  .empty{padding:18px;color:#8b90b3}
  .foot{padding:8px 14px;border-top:1px solid rgba(150,140,255,.15);color:#8b90b3;font-size:12px}`;
  let open = null;
  O.palette = {
    open(commands) {
      if (open) { open(); return; }
      const host = document.createElement('div');
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${CSS}</style><div class="ov"><div class="box"><input placeholder="Type a command…" aria-label="ORACLE command"><ul role="listbox"></ul><div class="foot">↑↓ choose · Enter run · Esc close</div></div></div>`;
      const input = root.querySelector('input'), ul = root.querySelector('ul'), ov = root.querySelector('.ov');
      let list = commands, idx = 0;
      const close = () => { host.remove(); open = null; document.removeEventListener('keydown', onKey, true); };
      const render = () => {
        ul.innerHTML = list.length ? '' : '<div class="empty">No matching command.</div>';
        list.forEach((c, i) => { const li = document.createElement('li'); li.className = i === idx ? 'sel' : ''; li.innerHTML = '<span></span><small></small>'; li.firstChild.textContent = c.title; li.lastChild.textContent = c.hint || ''; li.onclick = () => run(c); ul.appendChild(li); });
        const s = ul.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
      };
      const run = (c) => { close(); c.run(); };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(list.length - 1, idx + 1); render(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); render(); }
        else if (e.key === 'Enter' && list[idx]) { e.preventDefault(); e.stopPropagation(); run(list[idx]); }
      };
      input.addEventListener('input', () => {
        const q = input.value.toLowerCase().split(/\s+/).filter(Boolean);
        list = commands.filter(c => q.every(t => (c.title + ' ' + (c.hint || '')).toLowerCase().includes(t))); idx = 0; render();
      });
      ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
      document.addEventListener('keydown', onKey, true);
      document.documentElement.appendChild(host); render(); input.focus();
      open = close;
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
