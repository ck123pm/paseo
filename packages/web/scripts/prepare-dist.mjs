import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const appDistDir = path.resolve(packageRoot, "../app/dist");
const outputDir = path.join(packageRoot, "dist");
const packageJson = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));

if (!existsSync(appDistDir)) {
  throw new Error(`Missing app web build at ${appDistDir}. Run the app web build first.`);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
cpSync(appDistDir, outputDir, { recursive: true });
writeFileSync(
  path.join(outputDir, "metadata.json"),
  `${JSON.stringify({ packageName: packageJson.name, version: packageJson.version }, null, 2)}\n`,
  "utf8",
);
