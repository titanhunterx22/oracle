import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve("dist");
const MARKER = "/* ORACLE classic-script isolation wrapper */";
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
if (manifest.version !== "1.2.0") throw new Error("Unexpected extension version: " + manifest.version);
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
for (const requiredHost of ["https://hf.co", "https://*.hf.co", "https://cdn-lfs-eu-1.hf.co"]) {
  if (!csp.includes(requiredHost)) throw new Error("Extension CSP is missing Hugging Face CDN access: " + requiredHost);
}
for (const requiredHost of ["https://hf.co/*", "https://*.hf.co/*", "https://cdn-lfs-eu-1.hf.co/*"]) {
  if (!hostPermissions.includes(requiredHost)) throw new Error("Extension host permissions are missing Hugging Face CDN access: " + requiredHost);
}
const dashboard = await fs.readFile(path.join(root, "dashboard.html"), "utf8");
if (!dashboard.includes("aiPrepare") || !dashboard.includes("aiStatus")) throw new Error("Local AI dashboard controls are missing.");
if (!dashboard.includes("Qwen 2.5 1.5B") || !dashboard.includes("ai-specs")) {
  throw new Error("The Qwen model description/specifications are missing from the dashboard.");
}
const styleFiles = files.filter(file => file.endsWith(".css"));
const styleCode = (await Promise.all(styleFiles.map(file => fs.readFile(file, "utf8")))).join("\\n");
if (!styleCode.includes("--oracle-accent") || !styleCode.includes(".ai-specs")) {
  throw new Error("The shared ORACLE visual theme is missing from the packaged stylesheets.");
}
if (!dashboard.includes("dashboard.") && !dashboard.includes("webllm-client.entry")) throw new Error("Dashboard HTML does not appear to reference its bundled application assets.");
const scripts = files.filter(file => file.endsWith(".js"));
if (scripts.length < 2 || !scripts.some(file => /webllm-worker/i.test(path.basename(file)))) throw new Error("The bundled WebLLM worker was not emitted into dist/.");
const scriptBundles = await Promise.all(scripts.map(file => fs.readFile(file, "utf8")));
const allScriptCode = scriptBundles.join("\n");
if (!allScriptCode.includes("context_window_size") || !allScriptCode.includes("2048")) {
  throw new Error("The 2K Qwen WebLLM context-window override is missing from the build.");
}
if (!allScriptCode.includes("Qwen2.5-1.5B-Instruct-q4f32_1-MLC")) {
  throw new Error("The Qwen 2.5 1.5B model is missing from the build.");
}
if (!/max_tokens\s*:\s*384/.test(allScriptCode)) {
  throw new Error("The Qwen generation-token budget is missing from the build.");
}
if (!allScriptCode.includes("valid external instance reference no longer exists") ||
    !allScriptCode.includes("GPU device was lost while ORACLE was generating a reply")) {
  throw new Error("WebGPU device-loss detection and recovery are missing from the build.");
}
if (!allScriptCode.includes("Relevant saved Knowledge Vault notes")) {
  throw new Error("Local Knowledge Vault retrieval is missing from the AI prompt builder.");
}
const popup = await fs.readFile(path.join(root, popupPath), "utf8");
if (!popup.includes("webllm") && !scripts.some(file => /webllm-worker/i.test(path.basename(file)))) throw new Error("The popup does not include the WebLLM bundle.");

// Catch duplicate top-level lexical declarations that previously broke Edge.
function resolveAsset(src) {
  const clean = decodeURIComponent(String(src).split(/[?#]/, 1)[0]).replace(/^\/+/, "");
  const file = path.resolve(root, clean);
  if (file !== root && !file.startsWith(root + path.sep)) throw new Error("Invalid script asset path: " + src);
  return file;
}
const classicAssets = new Set();
async function requireIsolated(src) {
  const file = resolveAsset(src);
  if (!files.includes(file)) throw new Error("Referenced classic script is missing: " + src);
  const code = await fs.readFile(file, "utf8");
  if (!code.startsWith(MARKER)) throw new Error("Classic script is missing its scope-isolation wrapper: " + src);
  classicAssets.add(file);
}
for (const htmlFile of files.filter(file => file.endsWith(".html"))) {
  const html = await fs.readFile(htmlFile, "utf8");
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = match[1];
    const src = attrs.match(/\bsrc="([^"]+)"/i);
    if (src && !/\btype="module"/i.test(attrs)) await requireIsolated(src[1]);
  }
}
for (const entry of manifest.content_scripts || []) {
  for (const src of entry.js || []) await requireIsolated(src);
}
const combinedClassicCode = [];
for (const file of classicAssets) combinedClassicCode.push(await fs.readFile(file, "utf8"));
try {
  new vm.Script(combinedClassicCode.join("\n"), { filename: "combined-classic-extension-scripts.js" });
} catch (error) {
  throw new Error("Classic extension scripts still conflict or contain invalid JavaScript: " + error.message);
}
console.log("ORACLE build verified: Manifest V3, popup, dashboard, worker, model permissions and isolated classic scripts.");
