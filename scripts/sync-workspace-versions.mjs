import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const rootPackagePath = path.join(rootDir, "package.json");

const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8"));
const rootVersion = rootPackage.version;
const workspacePaths = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
const sharedMetadata = {
  homepage: rootPackage.homepage,
  repository: rootPackage.repository,
  author: rootPackage.author,
  license: rootPackage.license,
};

if (typeof rootVersion !== "string" || rootVersion.length === 0) {
  throw new Error('Root package.json must contain a valid "version"');
}

const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const pinnedWorkspaceDependencyRanges = new Map([
  [
    "@ck123pm/paseo-server",
    new Map([
      ["@getpaseo/highlight", "0.1.78"],
      ["@getpaseo/relay", "0.1.78"],
    ]),
  ],
]);

const workspacePackages = [];

for (const workspacePath of workspacePaths) {
  const packagePath = path.join(rootDir, workspacePath, "package.json");
  if (!existsSync(packagePath)) {
    continue;
  }

  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  if (typeof pkg.name === "string" && pkg.name.length > 0) {
    workspacePackages.push({ name: pkg.name, packagePath });
  }
}

const workspacePackageNames = new Set(workspacePackages.map((pkg) => pkg.name));

const touched = [];

for (const { packagePath } of workspacePackages) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  let changed = false;

  if (pkg.version !== rootVersion) {
    pkg.version = rootVersion;
    changed = true;
  }

  if (pkg.name === "@getpaseo/desktop") {
    for (const [field, value] of Object.entries(sharedMetadata)) {
      const currentValue = JSON.stringify(pkg[field]);
      const nextValue = JSON.stringify(value);
      if (currentValue !== nextValue) {
        pkg[field] = value;
        changed = true;
      }
    }
  }

  // Private workspaces (app, desktop) keep "*" for internal deps so npm always
  // resolves the local sibling, never a registry artifact. Publishable workspaces
  // get the root version so their published tarballs reference real npm versions.
  const internalDepRange = pkg.private === true ? "*" : rootVersion;
  const pinnedDeps = pinnedWorkspaceDependencyRanges.get(pkg.name);

  for (const section of dependencySections) {
    const deps = pkg[section];
    if (!deps || typeof deps !== "object") {
      continue;
    }

    for (const name of Object.keys(deps)) {
      if (!workspacePackageNames.has(name)) {
        continue;
      }
      if (name === pkg.name) {
        continue;
      }
      const targetRange = pinnedDeps?.get(name) ?? internalDepRange;
      if (deps[name] !== targetRange) {
        deps[name] = targetRange;
        changed = true;
      }
    }
  }

  if (changed) {
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    touched.push(path.relative(rootDir, packagePath));
  }
}

if (touched.length === 0) {
  console.log(`Workspace versions and internal deps already synced to ${rootVersion}`);
} else {
  console.log(`Synced to ${rootVersion}:`);
  for (const file of touched) {
    console.log(`- ${file}`);
  }
}
