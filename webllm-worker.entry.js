import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Register the WebLLM message handler during worker startup.
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (event) => handler.onmessage(event);
