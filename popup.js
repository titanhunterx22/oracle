(async function () {
  const O = window.ORACLE, $ = s => document.querySelector(s);
  const st = await O.store.settings();
  document.documentElement.classList.toggle('calm', !!st.reduceMotion);
  $('#orbwrap').insertAdjacentHTML('beforeend', O.orb.html()); O.orb.boot(); O.particles.start($('#fx'), st.particles && !st.reduceMotion);
  const chat = await O.chat.mount({ log: $('#log'), input: $('#input'), form: $('#form'), chips: $('#chips'), clearBtn: $('#clear'), compact: true });
  document.querySelectorAll('#quick [data-q]').forEach(b => b.onclick = () => chat.send(b.dataset.q));
  $('#dash').onclick = () => O.tools.openDashboard('#chat');
  $('#gear').onclick = () => O.tools.openDashboard('#settings');
  $('#input').focus();
})();
