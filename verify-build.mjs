import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const required = ["manifest.json", "popup.html", "dashboard.html"];
for (const file of required) {
  try { await fs.access(path.join(root, file)); }
  catch { throw new Error("Build output is missing " + file); }
}
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Expected a Manifest V3 extension.");
if (manifest.version !== "1.1.0") throw new Error("Unexpected extension version: " + manifest.version);
const csp = manifest.content_security_policy && manifest.content_security_policy.extension_pages || "";
for (const token of ["wasm-unsafe-eval", "huggingface.co", "raw.githubusercontent.com"]) {
  if (!csp.includes(token)) throw new Error("Extension CSP is missing " + token);
}
const hostPermissions = manifest.host_permissions || [];
if (!hostPermissions.some(origin => origin.includes("huggingface.co")) || !hostPermissions.some(origin => origin.includes("raw.githubusercontent.com"))) {
  throw new Error("Model download host permissions are missing.");
}
const dashboard = await fs.readFile(path.join(root, "dashboard.html"), "utf8");
if (!dashboard.includes('id="aiPrepare"') || !dashboard.includes('id="aiStatus"')) throw new Error("Local AI dashboard controls are missing.");
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
const scripts = files.filter(file => file.endsWith(".js"));
if (scripts.length < 2 || !scripts.some(file => /worker/i.test(path.basename(file)))) {
  throw new Error("The bundled WebLLM worker was not emitted into dist/.");
}
console.log("ORACLE build verified: Manifest V3, popup, dashboard, WebLLM worker and model download permissions are present.");
