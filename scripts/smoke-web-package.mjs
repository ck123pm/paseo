import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function run(command, args, options = {}) {
  const { cwd = repoRoot, env, allowFailure = false } = options;
  const useWindowsNpmShim = process.platform === "win32" && command === "npm";
  const resolvedCommand = useWindowsNpmShim ? (process.env.ComSpec ?? "cmd.exe") : command;
  const resolvedArgs = useWindowsNpmShim ? ["/d", "/s", "/c", "npm", ...args] : args;
  const commandLabel = [command, ...args].join(" ");
  process.stdout.write(`\n> ${commandLabel}\n`);

  try {
    const { stdout, stderr } = await execFileAsync(resolvedCommand, resolvedArgs, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 64,
    });

    if (stdout) {
      process.stdout.write(stdout);
      if (!stdout.endsWith("\n")) {
        process.stdout.write("\n");
      }
    }
    if (stderr) {
      process.stderr.write(stderr);
      if (!stderr.endsWith("\n")) {
        process.stderr.write("\n");
      }
    }

    return { stdout, stderr };
  } catch (error) {
    if (error.stdout) {
      process.stdout.write(error.stdout);
      if (!error.stdout.endsWith("\n")) {
        process.stdout.write("\n");
      }
    }
    if (error.stderr) {
      process.stderr.write(error.stderr);
      if (!error.stderr.endsWith("\n")) {
        process.stderr.write("\n");
      }
    }

    if (allowFailure) {
      return { stdout: error.stdout ?? "", stderr: error.stderr ?? "", error };
    }

    throw new Error(`Command failed: ${commandLabel}`, { cause: error });
  }
}

function tarballName(packageName, version) {
  return `${packageName.replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`;
}

async function readPackageJson(relativePath) {
  const packagePath = path.join(repoRoot, relativePath);
  return JSON.parse(await readFile(packagePath, "utf8"));
}

async function assertBundledDependencies(webTarball, bundleDependencies) {
  if (!Array.isArray(bundleDependencies) || bundleDependencies.length === 0) {
    return;
  }

  const { stdout } = await run("tar", ["-tf", webTarball]);
  for (const dependencyName of bundleDependencies) {
    const bundledPath = `package/node_modules/${dependencyName.replace(/\//g, "/")}/`;
    if (!stdout.includes(bundledPath)) {
      throw new Error(
        `Expected bundled dependency ${dependencyName} inside ${path.basename(webTarball)}, but it was missing.`,
      );
    }
  }
}

async function main() {
  const rootPkg = await readPackageJson("package.json");
  const serverPkg = await readPackageJson(path.join("packages", "server", "package.json"));
  const webPkg = await readPackageJson(path.join("packages", "web", "package.json"));

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "paseo-web-smoke-"));
  const packDir = path.join(tempRoot, "tarballs");
  const smokeDir = path.join(tempRoot, "install");
  const keepTemp = process.argv.includes("--keep-temp");

  process.stdout.write(`Using temp dir: ${tempRoot}\n`);

  try {
    await mkdir(packDir, { recursive: true });
    await mkdir(smokeDir, { recursive: true });

    await run("npm", ["pack", "--workspace=@ck123pm/paseo-server", "--pack-destination", packDir]);
    await run("npm", ["pack", "--workspace=@ck123pm/paseo-web", "--pack-destination", packDir]);

    const serverTarball = path.join(packDir, tarballName(serverPkg.name, serverPkg.version));
    const webTarball = path.join(packDir, tarballName(webPkg.name, webPkg.version));

    await assertBundledDependencies(webTarball, webPkg.bundleDependencies);

    await run("npm", ["init", "-y"], { cwd: smokeDir });
    await run("npm", ["install", serverTarball, webTarball], { cwd: smokeDir });
    await run(
      "node",
      [
        "-e",
        "import('@ck123pm/paseo-server').then(() => console.log('server-import-ok')).catch((error) => { console.error(error); process.exit(1); })",
      ],
      { cwd: smokeDir },
    );
    await run(
      "node",
      [
        "-p",
        "require('./node_modules/@ck123pm/paseo-web/package.json').dependencies['@ck123pm/paseo-server']",
      ],
      { cwd: smokeDir },
    );
    await run("node", ["node_modules/@ck123pm/paseo-web/bin/paseo-web.js", "--help"], {
      cwd: smokeDir,
    });

    process.stdout.write(
      `\nSmoke test passed for ${rootPkg.version}: packed tarballs install and paseo-web starts.\n`,
    );
  } catch (error) {
    process.stderr.write(`\nSmoke test failed.\n`);
    if (keepTemp) {
      process.stderr.write(`Temp directory kept at: ${tempRoot}\n`);
    }
    throw error;
  } finally {
    if (!keepTemp) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}

await main();
