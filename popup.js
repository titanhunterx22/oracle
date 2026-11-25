/* ORACLE popup bootstrap. Bind controls immediately so a startup failure cannot leave a dead popup. */
(async function () {
  'use strict';
  const O = window.ORACLE, $ = s => document.querySelector(s);
  const log = $('#log'), input = $('#input');
  let chat = null, initError = null;

  function report(error) {
    const message = error && error.message ? error.message : String(error || 'Unknown startup error');
    initError = message;
    if (log) {
      const el = document.createElement('div');
      el.className = 'msg bot err';
      const body = document.createElement('div'); body.className = 'md';
      body.textContent = 'ORACLE could not start: ' + message;
      el.appendChild(body); log.appendChild(el); log.scrollTop = log.scrollHeight;
    }
    try { O.orb && O.orb.set('error', 3000); } catch (_) {}
  }

  // These controls are wired before any asynchronous storage/model initialisation.
  $('#dash').addEventListener('click', () => {
    try { O.tools.openDashboard('#chat'); } catch (e) { report(e); }
  });
  $('#gear').addEventListener('click', () => {
    try { O.tools.openDashboard('#settings'); } catch (e) { report(e); }
  });

  const ready = (async () => {
    try {
      if (!O || !O.store || !O.chat || !O.tools) throw new Error('A required ORACLE script did not load. Reload the extension from edge://extensions.');
      const st = await O.store.settings();
      document.documentElement.classList.toggle('calm', !!st.reduceMotion);
      $('#orbwrap').insertAdjacentHTML('beforeend', O.orb.html());
      O.orb.boot();
      O.particles.start($('#fx'), st.particles && !st.reduceMotion);
      chat = await O.chat.mount({ log, input, form: $('#form'), chips: $('#chips'), clearBtn: $('#clear'), compact: true });
      return chat;
    } catch (e) {
      report(e);
      return null;
    }
  })();

  // The quick actions remain responsive even if the first startup attempt is still pending.
  document.querySelectorAll('#quick [data-q]').forEach(button => {
    button.addEventListener('click', async () => {
      const controller = await ready;
      if (controller) controller.send(button.dataset.q);
      else report(initError || 'Chat did not initialise. Reload ORACLE and try again.');
    });
  });

  // If the user submits while startup is pending, queue that first message instead of dropping it.
  $('#form').addEventListener('submit', async event => {
    if (chat) return; // O.chat.mount owns normal submission once it is ready.
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    const controller = await ready;
    if (controller) controller.send(value);
    else report(initError || 'Chat did not initialise. Reload ORACLE and try again.');
  }, true);

  await ready;
  if (input) input.focus();
})();
