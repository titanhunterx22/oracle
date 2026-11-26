import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";

// Qwen 2.5 1.5B q4f32 is a low-VRAM model; a 2K context balances useful prompts with shared-memory headroom.
// ChatOptions is the fourth argument to CreateWebWorkerMLCEngine (not engineConfig).
const LOW_MEMORY_CHAT_OPTIONS = {
  context_window_size: 2048,
};

// WebLLM's official worker-backed engine keeps inference off the extension UI thread.
async function createEngine(modelId, initProgressCallback) {
  const worker = new Worker(
    new URL("./webllm-worker.entry.js", import.meta.url),
    { type: "module", name: "ORACLE local AI" },
  );
  try {
    const engine = await CreateWebWorkerMLCEngine(
      worker,
      modelId,
      {
        initProgressCallback,
        logLevel: "WARN",
      },
      LOW_MEMORY_CHAT_OPTIONS,
    );
    return { engine, worker };
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

globalThis.ORACLE_WEBLLM = { createEngine };
if (typeof globalThis.ORACLE_WEBLLM_READY_RESOLVE === "function") {
  globalThis.ORACLE_WEBLLM_READY_RESOLVE(globalThis.ORACLE_WEBLLM);
  delete globalThis.ORACLE_WEBLLM_READY_RESOLVE;
}
