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
if (manifest.version !== "1.8.0") throw new Error("Unexpected extension version: " + manifest.version);
const dictionaryMetaPath = path.join(root, "dictionary-data", "metadata.json");
let dictionaryMeta;
try { dictionaryMeta = JSON.parse(await fs.readFile(dictionaryMetaPath, "utf8")); }
catch { throw new Error("The expanded offline dictionary metadata is missing or invalid."); }
if (!Number.isInteger(dictionaryMeta.word_count) || dictionaryMeta.word_count < 120000 ||
    !Number.isInteger(dictionaryMeta.sense_count) || dictionaryMeta.sense_count < 120000) {
  throw new Error("The expanded offline dictionary is incomplete: expected at least 120,000 word forms and senses.");
}
if (!dictionaryMeta.license_url || !dictionaryMeta.source) throw new Error("Dictionary attribution metadata is missing.");
for (const letter of "abcdefghijklmnopqrstuvwxyz") {
  if (!exists("dictionary-data/" + letter + ".json.gz")) throw new Error("Missing offline dictionary shard: " + letter);
}
if (!exists("dictionary-data/other.json.gz")) throw new Error("Missing non-Latin offline dictionary shard.");
const fullDictionaryScript = files.find(file => path.basename(file).startsWith("dictionary-full") && file.endsWith(".js"));
if (!fullDictionaryScript) throw new Error("The lazy offline dictionary loader was not bundled.");

const popupPath = manifest.action && manifest.action.default_popup;
if (!popupPath || !exists(popupPath)) throw new Error("Manifest popup entry is missing from the build: " + popupPath);
if (!exists("dashboard.html")) throw new Error("Build output is missing the stable dashboard.html runtime URL.");
if (!exists("ai-offscreen.html")) throw new Error("Build output is missing the shared local AI offscreen document.");
if (!files.some(file => path.basename(file).startsWith("ai-offscreen.") && file.endsWith(".js"))) throw new Error("Build output is missing the bundled offscreen local AI scripts.");
if (!files.some(file => path.basename(file).startsWith("local-ai-bridge.") && file.endsWith(".js"))) throw new Error("Build output is missing the bundled shared local AI bridge.");
if (!(manifest.permissions || []).includes("offscreen")) throw new Error("The offscreen permission is required for shared page and dashboard inference.");
if (!(manifest.permissions || []).includes("tabGroups")) throw new Error("The tabGroups permission is required for Smart Tab Manager grouping.");
const serviceWorkerPath = manifest.background && manifest.background.service_worker;
if (!serviceWorkerPath || !exists(serviceWorkerPath)) throw new Error("Manifest service worker is missing from the build: " + serviceWorkerPath);
const csp = manifest.content_security_policy && manifest.content_security_policy.extension_pages || "";
for (const token of ["wasm-unsafe-eval", "huggingface.co", "raw.githubusercontent.com"]) {
  if (!csp.includes(token)) throw new Error("Extension CSP is missing " + token);
}
const dictionaryResources = (manifest.web_accessible_resources || []).flatMap(item => item.resources || []);
if (!dictionaryResources.includes("dictionary-data/*.json.gz") || !dictionaryResources.includes("dictionary-data/metadata.json")) {
  throw new Error("Expanded offline dictionary assets are not exposed to content scripts. Emitted resources: " + JSON.stringify(manifest.web_accessible_resources || []));
}
const contentScripts = (manifest.content_scripts || []).flatMap(item => item.js || []);
const bridgeIndex = contentScripts.findIndex(src => path.basename(src).startsWith("local-ai-bridge") && src.endsWith(".js"));
const pageContentIndex = contentScripts.findIndex(src => path.basename(src).startsWith("content") && src.endsWith(".js"));
if (bridgeIndex < 0 || pageContentIndex < 0 || bridgeIndex > pageContentIndex) {
  throw new Error("The shared local AI bridge must be loaded before in-page selection tools.");
}
const fullDictionaryIndex = contentScripts.findIndex(src => path.basename(src).startsWith("dictionary-full") && src.endsWith(".js"));
const engineIndex = contentScripts.findIndex(src => path.basename(src).startsWith("engine") && src.endsWith(".js"));
if (fullDictionaryIndex < 0 || engineIndex < 0 || fullDictionaryIndex > engineIndex) {
  throw new Error("The offline dictionary loader must run before the engine in content scripts.");
}
const hostPermissions = manifest.host_permissions || [];
if (!hostPermissions.includes("http://127.0.0.1:8765/*")) throw new Error("The localhost permission for the ORACLE Creative Studio companion is missing.");
if (!csp.includes("connect-src") || !csp.includes("http://127.0.0.1:8765") || !csp.includes("img-src") || !csp.includes("blob:")) throw new Error("The extension CSP does not allow the local Creative Studio bridge and preview images.");
if (csp.includes("worker-src blob:")) throw new Error("Do not reintroduce blob: workers; Edge previously rejected that extension CSP.");

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
if (!dashboard.includes("Creative Studio") || !dashboard.includes('id="creativeGenerate"') || !dashboard.includes('id="creativePrepare"') || !dashboard.includes('id="creativeGallery"')) throw new Error("The Creative Studio controls are missing from the packaged dashboard.");

if (!dashboard.includes("150,000 English word forms")) {
  throw new Error("The expanded offline dictionary is not wired into the dashboard.");
}
if (!dashboard.includes("aiPrepare") || !dashboard.includes("aiStatus")) throw new Error("Local AI dashboard controls are missing.");
if (!dashboard.includes("Qwen 2.5 1.5B") || !dashboard.includes("ai-specs")) {
  throw new Error("The Qwen model description/specifications are missing from the dashboard.");
}
if (!dashboard.includes('id="tbSmartOrganise"') || !dashboard.includes('id="tbWorkspaces"') || !dashboard.includes('id="tbWorkspaceRestore"') || !dashboard.includes("Smart tab manager")) {
  throw new Error("The Smart Tab Manager UI is missing from the dashboard.");
}
const dashboardSourceForTabs = await fs.readFile(path.resolve("dashboard.js"), "utf8");
if (!dashboardSourceForTabs.includes("oracle_tab_workspaces_v1") || !dashboardSourceForTabs.includes("function topicForTab") || !dashboardSourceForTabs.includes("chrome.tabs.group") || !dashboardSourceForTabs.includes("chrome.tabs.ungroup")) {
  throw new Error("Smart Tab Manager organisation, grouping or local workspace logic is missing.");
}
if (!dashboard.includes('id="researchTabList"') || !dashboard.includes('id="researchRun"') || !dashboard.includes("Cross-tab research")) {
  throw new Error("The Cross-tab Research workspace is missing from the dashboard.");
}
if (!dashboard.includes('id="writerDraft"') || !dashboard.includes('id="writerRun"') || !dashboard.includes('id="writerReview"') || !dashboard.includes("Writing studio")) {
  throw new Error("The Writing Assistant workspace is missing from the dashboard.");
}
const styleFiles = files.filter(file => file.endsWith(".css"));
const styleCode = (await Promise.all(styleFiles.map(file => fs.readFile(file, "utf8")))).join("\\n");
if (!styleCode.includes("--oracle-accent") || !styleCode.includes(".ai-specs")) {
  throw new Error("The shared ORACLE visual theme is missing from the packaged stylesheets.");
}
if (!styleCode.includes(".creative-layout") || !styleCode.includes(".creative-gallery-grid")) throw new Error("Creative Studio dashboard styles are missing from the build.");
if (!styleCode.includes(".writing-layout") || !styleCode.includes("#writerDraft")) {
  throw new Error("The Writing Assistant visual styles are missing from the build.");
}
if (!dashboard.includes("dashboard.") && !dashboard.includes("webllm-client.entry")) throw new Error("Dashboard HTML does not appear to reference its bundled application assets.");
if (!dashboard.includes("VERSION <b>1.8.0</b>")) throw new Error("Dashboard version display is stale.");
if (!dashboard.includes("dashboard.")) throw new Error("Dashboard application scripts are missing from the built dashboard.");
const offscreenHtml = await fs.readFile(path.join(root, "ai-offscreen.html"), "utf8");
if (!offscreenHtml.includes("ai-offscreen.") || !/type="module"/.test(offscreenHtml)) {
  throw new Error("The hidden AI document is missing its bundled WebLLM module or local AI runtime scripts.");
}
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
if (!/max_tokens\s*:/.test(allScriptCode) || !allScriptCode.includes("448") || !allScriptCode.includes("384")) {
  throw new Error("The Qwen generation-token budgets for detailed analysis and normal replies are missing from the build.");
}
for (const taskPrompt of ["in-depth analytical breakdown", "revision notes", "understanding-focused", "Dictionary or other reference material", "structured website overview", "meaningful keywords and themes", "Compare the two supplied webpages in depth", "expert writing editor", "thoughtful professional editor"]) {
  if (!allScriptCode.includes(taskPrompt)) throw new Error("A required local AI analysis prompt is missing: " + taskPrompt);
}
if (!allScriptCode.includes("oracle:ai:request") || !allScriptCode.includes("oracle:ai:offscreen") ||
    !allScriptCode.includes("OFFSCREEN_DOCUMENT") || !allScriptCode.includes("Waiting for local model setup")) {
  throw new Error("The shared offscreen local AI request bridge or hidden runtime handler is missing.");
}
const offscreenSource = await fs.readFile(path.resolve("ai-offscreen.js"), "utf8");
const localAiSource = await fs.readFile(path.resolve("local-ai.js"), "utf8");
if (!offscreenSource.includes("runSerial") || !offscreenSource.includes("inferenceQueue") || !localAiSource.includes("secondaryPage")) {
  throw new Error("Shared AI inference must be serialized and support two-page comparison context.");
}
if (!localAiSource.includes("SOURCE_LIMIT") || !localAiSource.includes("Numbered cross-tab research source set") || !localAiSource.includes("research: 'Act as a careful research analyst")) {
  throw new Error("Grounded multi-source Qwen research prompt is missing.");
}
if (!allScriptCode.includes("valid external instance reference no longer exists") ||
    !allScriptCode.includes("GPU device was lost while ORACLE was generating a reply")) {
  throw new Error("WebGPU device-loss detection and recovery are missing from the build.");
}
if (!allScriptCode.includes("Relevant saved Knowledge Vault notes")) {
  throw new Error("Local Knowledge Vault retrieval is missing from the AI prompt builder.");
}
if (!localAiSource.includes("WRITING_DRAFT_LIMIT") || !localAiSource.includes("writing_review") || !localAiSource.includes("User writing draft")) {
  throw new Error("Local writing prompts or bounded draft context are missing from the source.");
}
const dashboardSource = await fs.readFile(path.resolve("dashboard.js"), "utf8");
if (!dashboardSource.includes("127.0.0.1:8765") || !dashboardSource.includes("creativeImprove") || !dashboardSource.includes("creativeRenderGallery")) throw new Error("The dashboard is missing its local image-engine bridge or prompt/gallery controls.");
if (!localAiSource.includes("image_prompt:") || !dashboardSource.includes("askTask('image_prompt'")) throw new Error("Local Qwen image-prompt enhancement is missing.");
const companionRoot = path.resolve("companion/image-engine");
for (const required of ["server.py", "requirements.txt", "README.md", "Install-ORACLE-Creative-Studio.ps1", "Start-ORACLE-Creative-Studio.ps1"]) {
  try { await fs.access(path.join(companionRoot, required)); } catch { throw new Error("Creative Studio companion file is missing: " + required); }
}
const companionServer = await fs.readFile(path.join(companionRoot, "server.py"), "utf8");
if (!companionServer.includes("Text2ImagePipeline") || !companionServer.includes("127.0.0.1") || !companionServer.includes("EXTENSION_ORIGIN") || !companionServer.includes("X-ORACLE-Client")) throw new Error("The local OpenVINO image service or extension-origin protections are missing.");
if (!companionServer.includes('"GPU"') || !companionServer.includes('"CPU"')) throw new Error("The companion must support Intel GPU detection and CPU fallback.");

if (!dashboardSource.includes("oracle_writing_workspace_v1") || !dashboardSource.includes("writerDraft") || !dashboardSource.includes("writerReview")) {
  throw new Error("Local writing draft recovery or dashboard controls are missing from the source.");
}
if (!allScriptCode.includes("fab-orbit") || !allScriptCode.includes("Research tab list refreshed")) {
  throw new Error("The refreshed selection orb or cross-tab research controls are missing from the build.");
}
const popup = await fs.readFile(path.join(root, popupPath), "utf8");
if (!files.some(file => path.basename(file).startsWith("dictionary-full") && file.endsWith(".js"))) throw new Error("The expanded offline dictionary loader is missing from the package.");
if (!popup.includes("popup.")) throw new Error("Popup application scripts are missing from the built popup.");
if (!scripts.some(file => /webllm-worker/i.test(path.basename(file)))) throw new Error("The WebLLM worker bundle is missing from the offscreen runtime.");

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
