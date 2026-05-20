#!/usr/bin/env node

import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPaseoDaemon,
  createRootLogger,
  loadConfig,
  resolvePaseoHome,
} from "@getpaseo/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const distDir = path.resolve(packageRoot, "dist");
const defaultWebHost = "127.0.0.1";
const defaultWebPort = 4173;
const defaultDaemonListen = "127.0.0.1:6767";

function parseArgs(argv) {
  const options = {
    webHost: defaultWebHost,
    webPort: defaultWebPort,
    daemonListen: defaultDaemonListen,
    home: null,
    open: false,
    relay: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if ((arg === "--host" || arg === "--web-host") && argv[index + 1]) {
      options.webHost = argv[index + 1];
      index += 1;
      continue;
    }
    if ((arg === "--port" || arg === "--web-port") && argv[index + 1]) {
      const port = Number.parseInt(argv[index + 1], 10);
      if (!Number.isNaN(port)) options.webPort = port;
      index += 1;
      continue;
    }
    if (arg === "--daemon-listen" && argv[index + 1]) {
      options.daemonListen = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--home" && argv[index + 1]) {
      options.home = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--open") {
      options.open = true;
      continue;
    }
    if (arg === "--relay") {
      options.relay = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp(0);
    }
  }

  return options;
}

function printHelp(exitCode) {
  process.stdout.write(
    [
      "Usage: paseo-web [--open] [--host 127.0.0.1] [--port 4173] [--home <path>]",
      "                 [--daemon-listen 127.0.0.1:6767] [--relay]",
      "",
      "Starts the packaged Paseo web app and an embedded local daemon.",
      "Stopping this process also stops the embedded daemon.",
    ].join("\n") + "\n",
  );
  process.exit(exitCode);
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function resolveRequestPath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname);
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[\\/])+/, "");
  const candidatePath = path.join(distDir, normalizedPath);

  if (existsSync(candidatePath)) {
    const candidateStat = await stat(candidatePath);
    if (candidateStat.isFile()) return candidatePath;
    if (candidateStat.isDirectory()) {
      const indexPath = path.join(candidatePath, "index.html");
      if (existsSync(indexPath)) return indexPath;
    }
  }

  return path.join(distDir, "index.html");
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function formatWebUrl(host, port) {
  return `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`;
}

function injectedDesktopBridgeScript() {
  return `<script>
(() => {
  const existing = typeof window.paseoDesktop === "object" && window.paseoDesktop ? window.paseoDesktop : {};
  const dialog = typeof existing.dialog === "object" && existing.dialog ? existing.dialog : {};
  window.paseoDesktop = {
    ...existing,
    dialog: {
      ...dialog,
      open: async (options = {}) => {
        const response = await fetch("/__paseo/dialog/open", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(options),
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to open native dialog.");
        }
        return response.json();
      },
    },
  };
})();
</script>`;
}

function injectDesktopBridge(html) {
  const script = injectedDesktopBridgeScript();
  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }
  if (html.includes("</body>")) {
    return html.replace("</body>", `${script}</body>`);
  }
  return `${html}\n${script}`;
}

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: "utf8", windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve((stdout ?? "").trim());
    });
  });
}

async function selectDirectoryNative() {
  if (process.platform === "win32") {
    const output = await execFileAsync("powershell", [
      "-NoProfile",
      "-STA",
      "-Command",
      [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
        '$dialog.Description = "Select a project folder"',
        "$dialog.ShowNewFolderButton = $false",
        "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
        "  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
        "  Write-Output $dialog.SelectedPath",
        "}",
      ].join("; "),
    ]);
    return output || null;
  }

  if (process.platform === "darwin") {
    const output = await execFileAsync("osascript", [
      "-e",
      'POSIX path of (choose folder with prompt "Select a project folder")',
    ]);
    return output || null;
  }

  try {
    const output = await execFileAsync("zenity", [
      "--file-selection",
      "--directory",
      "--title=Select a project folder",
    ]);
    return output || null;
  } catch {
    try {
      const output = await execFileAsync("kdialog", [
        "--getexistingdirectory",
        ".",
        "--title",
        "Select a project folder",
      ]);
      return output || null;
    } catch {
      throw new Error("Native directory picker is unavailable on this system.");
    }
  }
}

if (!existsSync(distDir)) {
  process.stderr.write(
    `Missing web assets at ${distDir}. Reinstall the package or run npm run build before starting.\n`,
  );
  process.exit(1);
}

const options = parseArgs(process.argv.slice(2));
const daemonHomeEnv = options.home ? { ...process.env, PASEO_HOME: options.home } : process.env;
const paseoHome = resolvePaseoHome(daemonHomeEnv);
const daemonConfig = loadConfig(paseoHome, {
  env: {
    ...daemonHomeEnv,
    PASEO_LISTEN: options.daemonListen,
    PASEO_RELAY_ENABLED: options.relay ? "true" : "false",
  },
  cli: {
    listen: options.daemonListen,
    relayEnabled: options.relay,
  },
});
const logger = createRootLogger(
  {
    log: {
      console: {
        level: "info",
        format: "pretty",
      },
    },
  },
  { paseoHome, file: false },
);

const daemon = await createPaseoDaemon(daemonConfig, logger);
await daemon.start();

const daemonListenTarget = daemon.getListenTarget();
if (!daemonListenTarget || daemonListenTarget.type !== "tcp") {
  await daemon.stop().catch(() => undefined);
  throw new Error(
    "Embedded Paseo web launcher requires a TCP daemon listen target such as 127.0.0.1:6767.",
  );
}
const daemonEndpoint =
  `${daemonListenTarget.host}:${daemonListenTarget.port}`;

const webServer = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "POST" && requestUrl.pathname === "/__paseo/dialog/open") {
      let rawBody = "";
      for await (const chunk of request) {
        rawBody += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      }

      const options = rawBody ? JSON.parse(rawBody) : {};
      if (!options || options.directory !== true || options.multiple === true) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Only single-directory selection is supported.");
        return;
      }

      try {
        const selectedPath = await selectDirectoryNative();
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(selectedPath));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open native dialog.";
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(message);
      }
      return;
    }

    const filePath = await resolveRequestPath(requestUrl.pathname);
    if (filePath.endsWith("index.html")) {
      const html = await readFile(filePath, "utf8");
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      response.end(injectDesktopBridge(html));
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Failed to serve Paseo web app: ${message}`);
  }
});

let cleanupStarted = false;

async function cleanup(exitCode = 0) {
  if (cleanupStarted) {
    return;
  }
  cleanupStarted = true;

  await new Promise((resolve) => {
    webServer.close(() => resolve(undefined));
  }).catch(() => undefined);

  await daemon.stop().catch(() => undefined);
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    void cleanup(0);
  });
}

process.on("uncaughtException", (error) => {
  console.error(error);
  void cleanup(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(reason);
  void cleanup(1);
});

webServer.once("error", (error) => {
  console.error(error);
  void cleanup(1);
});

webServer.listen(options.webPort, options.webHost, () => {
  const webUrl = formatWebUrl(options.webHost, options.webPort);
  process.stdout.write(`Paseo web running at ${webUrl}\n`);
  process.stdout.write(`Embedded daemon listening at ${daemonEndpoint}\n`);
  process.stdout.write("Stopping this process will also stop the embedded daemon.\n");
  if (options.open) openBrowser(webUrl);
});
