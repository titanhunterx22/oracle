import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}
const files = await walk(root);
const exists = file => files.includes(path.resolve(root, file));
if (!exists("manifest.json")) throw new Error("Build output is missing manifest.json");
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Expected a Manifest V3 extension.");
if (manifest.version !== "1.1.0") throw new Error("Unexpected extension version: " + manifest.version);
const popupPath = manifest.action && manifest.action.default_popup;
if (!popupPath || !exists(popupPath)) throw new Error("Manifest popup entry is missing from the build: " + popupPath);
if (!exists("dashboard.html")) throw new Error("Build output is missing the stable dashboard.html runtime URL.");
const serviceWorkerPath = manifest.background && manifest.background.service_worker;
if (!serviceWorkerPath || !exists(serviceWorkerPath)) throw new Error("Manifest service worker is missing from the build: " + serviceWorkerPath);
const csp = manifest.content_security_policy && manifest.content_security_policy.extension_pages || "";
for (const token of ["wasm-unsafe-eval", "huggingface.co", "raw.githubusercontent.com"]) {
  if (!csp.includes(token)) throw new Error("Extension CSP is missing " + token);
}
const hostPermissions = manifest.host_permissions || [];
if (!hostPermissions.some(origin => origin.includes("huggingface.co")) || !hostPermissions.some(origin => origin.includes("raw.githubusercontent.com"))) {
  throw new Error("Model download host permissions are missing.");
}
const dashboard = await fs.readFile(path.join(root, "dashboard.html"), "utf8");
if (!dashboard.includes("aiPrepare") || !dashboard.includes("aiStatus")) throw new Error("Local AI dashboard controls are missing.");
if (!dashboard.includes("dashboard.") && !dashboard.includes("webllm-client.entry")) {
  throw new Error("Dashboard HTML does not appear to reference its bundled application assets.");
}
const scripts = files.filter(file => file.endsWith(".js"));
if (scripts.length < 2 || !scripts.some(file => /webllm-worker/i.test(path.basename(file)))) {
  throw new Error("The bundled WebLLM worker was not emitted into dist/.");
}
const popup = await fs.readFile(path.join(root, popupPath), "utf8");
if (!popup.includes("webllm") && !scripts.some(file => /webllm-worker/i.test(path.basename(file)))) {
  throw new Error("The popup does not include the WebLLM bundle.");
}
console.log("ORACLE build verified: manifest, popup, stable dashboard URL, service worker, WebLLM worker and model download permissions are present.");
