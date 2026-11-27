/* ORACLE Local AI bridge. The service worker forwards work to one shared offscreen WebGPU runtime. */
(function (g) {
  'use strict';
  const O = g.ORACLE = g.ORACLE || {};
  const pause = ms => new Promise(resolve => g.setTimeout(resolve, ms));
  let sequence = 0;

  async function request(action, payload) {
    if (!g.chrome || !g.chrome.runtime || !g.chrome.runtime.sendMessage) {
      throw new Error('ORACLE could not contact its local AI runtime. Reload the extension and try again.');
    }
    let response;
    try {
      response = await g.chrome.runtime.sendMessage(Object.assign({
        type: 'oracle:ai:request',
        action,
        requestId: 'oracle-ai-' + Date.now() + '-' + (++sequence)
      }, payload || {}));
    } catch (error) {
      throw new Error('ORACLE could not reach its shared local AI runtime: ' + (error && error.message ? error.message : String(error)));
    }
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : 'The local AI runtime returned no response.');
    }
    return response;
  }

  async function status() {
    const response = await request('status');
    return response.info;
  }

  async function prepare(onProgress) {
    await request('prepare');
    const started = Date.now();
    let lastProgress = '';
    while (Date.now() - started < 20 * 60 * 1000) {
      await pause(800);
      const current = await status();
      const progress = current.progress || {};
      const signature = String(progress.percent || 0) + '|' + String(progress.detail || current.message || '');
      if (signature !== lastProgress && typeof onProgress === 'function') {
        lastProgress = signature;
        onProgress(progress.percent || 0, progress.detail || current.message || 'Preparing local model');
      }
      if (current.state === 'available') {
        if (typeof onProgress === 'function') onProgress(100, 'Local AI is ready');
        return { state: 'ready', model: O.localAI.model, message: current.message };
      }
      if (current.lastError) throw new Error(current.lastError);
      if (current.state === 'unsupported' || current.state === 'unavailable') throw new Error(current.message);
    }
    throw new Error('Local AI setup did not finish within 20 minutes. The downloaded model files are kept; try again.');
  }

  async function ask(question, options) {
    const response = await request('ask', { question: String(question || ''), options: options || {} });
    return response.text;
  }

  async function askTask(task, options) {
    const response = await request('askTask', { task: String(task || 'explain'), options: options || {} });
    return response.text;
  }

  async function destroy() {
    await request('destroy');
  }

  O.localAI = {
    status,
    prepare,
    ask,
    askTask,
    destroy,
    model: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'
  };
})(typeof self !== 'undefined' ? self : globalThis);
