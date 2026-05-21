import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeNextReleaseVersion } from "./release-version-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const rootPackagePath = path.join(rootDir, "package.json");
const rootLockfilePath = path.join(rootDir, "package-lock.json");
const serverPackagePath = path.join(rootDir, "packages", "server", "package.json");
const webPackagePath = path.join(rootDir, "packages", "web", "package.json");
const workspacePaths = [
  "packages/app/package.json",
  "packages/cli/package.json",
  "packages/desktop/package.json",
  "packages/expo-two-way-audio/package.json",
  "packages/highlight/package.json",
  "packages/relay/package.json",
  "packages/server/package.json",
  "packages/web/package.json",
  "packages/website/package.json",
];
const forkPublishedPackages = new Set(["@ck123pm/paseo-server", "@ck123pm/paseo-web"]);
const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

function usageAndExit(code = 1) {
  process.stderr.write(`Usage: node scripts/cut-fork-release.mjs --mode <mode> [--print]\n`);
  process.stderr.write(
    "Modes: patch, beta-patch, beta-next, promote. This script only versions paseo-server and paseo-web.\n",
  );
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    mode: "",
    print: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") {
      args.mode = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--print") {
      args.print = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usageAndExit(0);
    }
    usageAndExit();
  }

  if (!args.mode) {
    usageAndExit();
  }

  if (!["patch", "beta-patch", "beta-next", "promote"].includes(args.mode)) {
    throw new Error(`Unsupported fork release mode "${args.mode}".`);
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function updateWorkspaceDependencyRanges(pkg, nextVersion) {
  let changed = false;
  const internalDepRange = pkg.private === true ? "*" : nextVersion;

  for (const section of dependencySections) {
    const deps = pkg[section];
    if (!deps || typeof deps !== "object") {
      continue;
    }

    for (const packageName of Object.keys(deps)) {
      if (!forkPublishedPackages.has(packageName)) {
        continue;
      }
      if (deps[packageName] !== internalDepRange) {
        deps[packageName] = internalDepRange;
        changed = true;
      }
    }
  }

  return changed;
}

function updatePackageLock(lockfile, nextVersion, changedWorkspaceEntries) {
  lockfile.version = nextVersion;
  if (lockfile.packages?.[""]) {
    lockfile.packages[""].version = nextVersion;
  }

  const serverEntry = lockfile.packages?.["packages/server"];
  if (serverEntry) {
    serverEntry.version = nextVersion;
  }

  const webEntry = lockfile.packages?.["packages/web"];
  if (webEntry) {
    webEntry.version = nextVersion;
    if (webEntry.dependencies?.["@ck123pm/paseo-server"] !== undefined) {
      webEntry.dependencies["@ck123pm/paseo-server"] = nextVersion;
    }
  }

  for (const workspaceEntry of changedWorkspaceEntries) {
    const packageKey = workspaceEntry.packageKey;
    const entry = lockfile.packages?.[packageKey];
    if (!entry?.dependencies) {
      continue;
    }

    for (const packageName of Object.keys(entry.dependencies)) {
      if (!forkPublishedPackages.has(packageName)) {
        continue;
      }
      entry.dependencies[packageName] = workspaceEntry.internalDepRange;
    }
  }
}

function runGit(args) {
  execFileSync("git", args, { cwd: rootDir, stdio: "inherit" });
}

function runGitQuiet(args) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
}

function ensureCleanWorktree() {
  const status = runGitQuiet(["status", "--short"]);
  if (status) {
    throw new Error("Working tree must be clean before cutting a fork release.");
  }
}

function ensureTagDoesNotExist(tag) {
  try {
    runGitQuiet(["rev-list", "-n", "1", tag]);
    throw new Error(`Tag ${tag} already exists locally.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      throw error;
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const rootPackage = readJson(rootPackagePath);
const currentVersion = typeof rootPackage.version === "string" ? rootPackage.version.trim() : "";

if (!currentVersion) {
  throw new Error('Root package.json must contain a valid "version".');
}

const nextVersion = computeNextReleaseVersion(currentVersion, args.mode);

if (args.print) {
  process.stdout.write(`${nextVersion}\n`);
  process.exit(0);
}

ensureCleanWorktree();

const tag = `v${nextVersion}`;
ensureTagDoesNotExist(tag);

rootPackage.version = nextVersion;
writeJson(rootPackagePath, rootPackage);

const serverPackage = readJson(serverPackagePath);
serverPackage.version = nextVersion;
writeJson(serverPackagePath, serverPackage);

const webPackage = readJson(webPackagePath);
webPackage.version = nextVersion;
if (!webPackage.dependencies || typeof webPackage.dependencies !== "object") {
  throw new Error("packages/web/package.json must define dependencies.");
}
webPackage.dependencies["@ck123pm/paseo-server"] = nextVersion;
writeJson(webPackagePath, webPackage);

const changedWorkspaceEntries = [];
for (const relativePackagePath of workspacePaths) {
  const absPath = path.join(rootDir, relativePackagePath);
  const pkg = readJson(absPath);
  if (absPath === serverPackagePath || absPath === webPackagePath) {
    continue;
  }
  if (updateWorkspaceDependencyRanges(pkg, nextVersion)) {
    writeJson(absPath, pkg);
    changedWorkspaceEntries.push({
      relativePackagePath,
      packageKey: relativePackagePath.replaceAll("\\", "/").replace(/\/package\.json$/, ""),
      internalDepRange: pkg.private === true ? "*" : nextVersion,
    });
  }
}

const lockfile = readJson(rootLockfilePath);
updatePackageLock(lockfile, nextVersion, changedWorkspaceEntries);
writeJson(rootLockfilePath, lockfile);

runGit(["add", "package.json", "package-lock.json", "packages/server/package.json", "packages/web/package.json"]);
for (const changedWorkspaceEntry of changedWorkspaceEntries) {
  runGit(["add", changedWorkspaceEntry.relativePackagePath.replaceAll("\\", "/")]);
}
runGit(["commit", "--no-verify", "-m", `chore(release): cut ${nextVersion}`]);
runGit(["tag", tag]);

process.stdout.write(`Cut fork release ${nextVersion}\n`);
