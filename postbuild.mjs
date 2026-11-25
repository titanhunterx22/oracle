import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const MARKER = "/* ORACLE classic-script isolation wrapper */";

const stableDashboard = path.join(root, "dashboard.html");
try {
  await fs.access(stableDashboard);
  console.log("Parcel emitted the stable dashboard.html runtime URL.");
} catch {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dashboardBundle = entries.filter(entry => entry.isFile() && entry.name.startsWith("dashboard.") && entry.name.endsWith(".html")).map(entry => path.join(root, entry.name))[0];
  if (!dashboardBundle) throw new Error("Parcel did not emit the dashboard HTML entry.");
  await fs.copyFile(dashboardBundle, stableDashboard);
}

function resolveAsset(src) {
  const clean = decodeURIComponent(String(src).split(/[?#]/, 1)[0]).replace(/^\/+/, "");
  const file = path.resolve(root, clean);
  if (file !== root && !file.startsWith(root + path.sep)) throw new Error("Asset outside dist/: " + src);
  return file;
}

const isolated = new Set();
async function isolateClassicScript(src) {
  const file = resolveAsset(src);
  if (isolated.has(file)) return;
  isolated.add(file);
  let code;
  try { code = await fs.readFile(file, "utf8"); }
  catch { throw new Error("Classic script missing from dist/: " + src); }
  if (code.startsWith(MARKER)) return;
  // Chromium executes each manifest content-script file in the same isolated-world
  // global scope. HTML classic scripts also share the page global scope. Parcel's
  // minifier can lift IIFE locals into top-level let declarations, so otherwise
  // unrelated bundles can collide. Isolate each classic bundle while retaining the
  // shared window/self ORACLE namespace.
  await fs.writeFile(file, MARKER + "\n(function () {\n" + code + "\n}).call(self);\n", "utf8");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(full));
    else found.push(full);
  }
  return found;
}

for (const htmlFile of (await walk(root)).filter(file => file.endsWith(".html"))) {
  const html = await fs.readFile(htmlFile, "utf8");
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = match[1];
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch || /\btype\s*=\s*["']module["']/i.test(attrs)) continue;
    await isolateClassicScript(srcMatch[1]);
  }
}

const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
for (const entry of manifest.content_scripts || []) {
  for (const src of entry.js || []) await isolateClassicScript(src);
}
console.log("Isolated " + isolated.size + " classic script bundle(s) across extension pages and content scripts.");
