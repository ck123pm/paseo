import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReleaseVersion } from "./release-version-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const rootPackagePath = path.join(rootDir, "package.json");

function usageAndExit(code = 1) {
  process.stderr.write(
    "Usage: node scripts/publish-fork-release.mjs [--otp <code>] [--dry-run]\n",
  );
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    otp: "",
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--otp") {
      args.otp = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usageAndExit(0);
    }
    usageAndExit();
  }

  return args;
}

function publishWorkspace(workspace, tag, args) {
  const publishArgs = ["publish", `--workspace=${workspace}`, "--access", "public", "--tag", tag];
  if (args.dryRun) {
    publishArgs.push("--dry-run");
  }
  if (args.otp) {
    publishArgs.push(`--otp=${args.otp}`);
  }
  if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "npm", ...publishArgs], {
      cwd: rootDir,
      stdio: "inherit",
    });
    return;
  }

  execFileSync("npm", publishArgs, {
    cwd: rootDir,
    stdio: "inherit",
  });
}

const args = parseArgs(process.argv.slice(2));
const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8"));
const version = typeof rootPackage.version === "string" ? rootPackage.version.trim() : "";
if (!version) {
  throw new Error('Root package.json must contain a valid "version".');
}

const release = parseReleaseVersion(version);
const tag = release.isPrerelease ? "beta" : "latest";

publishWorkspace("@ck123pm/paseo-server", tag, args);
publishWorkspace("@ck123pm/paseo-web", tag, args);
