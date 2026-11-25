import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const stableDashboard = path.join(root, "dashboard.html");
try {
  await fs.access(stableDashboard);
  console.log("Parcel emitted the stable dashboard.html runtime URL.");
} catch {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dashboardBundle = entries
    .filter(entry => entry.isFile() && entry.name.startsWith("dashboard.") && entry.name.endsWith(".html"))
    .map(entry => path.join(root, entry.name))[0];
  if (!dashboardBundle) {
    throw new Error("Parcel did not emit the dashboard HTML entry. Check the dashboard.html build entry.");
  }
  await fs.copyFile(dashboardBundle, stableDashboard);
  console.log("Created stable dist/dashboard.html for ORACLE's runtime dashboard URL.");
}
