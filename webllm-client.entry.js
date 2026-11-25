import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";

// WebLLM's official worker-backed engine keeps inference off the extension UI thread.
async function createEngine(modelId, initProgressCallback) {
  const worker = new Worker(
    new URL("./webllm-worker.entry.js", import.meta.url),
    { type: "module", name: "ORACLE local AI" },
  );
  try {
    const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
      initProgressCallback,
      logLevel: "WARN",
    });
    return { engine, worker };
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

globalThis.ORACLE_WEBLLM = { createEngine };
