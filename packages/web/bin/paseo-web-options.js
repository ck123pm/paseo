const defaultWebHost = "127.0.0.1";
const defaultWebPort = 8081;

function dedupeOrigins(origins) {
  return Array.from(new Set(origins.filter((origin) => origin.length > 0)));
}

function buildLocalWebAllowedOrigins(webHost, webPort) {
  const origins = [];
  const normalizedHost = webHost.trim().toLowerCase();

  origins.push(`http://${webHost}:${webPort}`);

  if (
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "localhost" ||
    normalizedHost === "0.0.0.0"
  ) {
    origins.push(`http://127.0.0.1:${webPort}`);
    origins.push(`http://localhost:${webPort}`);
  }

  return dedupeOrigins(origins);
}

export function parseArgs(argv) {
  const options = {
    webHost: null,
    webPort: null,
    daemonListen: null,
    home: null,
    open: false,
    relay: null,
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
      return { kind: "help", options };
    }
  }

  return { kind: "run", options };
}

export function buildDaemonLoadConfigOptions(options, daemonHomeEnv, webServerOptions) {
  const webAllowedOrigins =
    webServerOptions?.webHost && webServerOptions?.webPort
      ? buildLocalWebAllowedOrigins(webServerOptions.webHost, webServerOptions.webPort)
      : [];
  const mergedCorsOrigins = dedupeOrigins([
    ...(daemonHomeEnv.PASEO_CORS_ORIGINS
      ? daemonHomeEnv.PASEO_CORS_ORIGINS.split(",").map((s) => s.trim())
      : []),
    ...webAllowedOrigins,
  ]);

  return {
    env: {
      ...daemonHomeEnv,
      ...(mergedCorsOrigins.length > 0 ? { PASEO_CORS_ORIGINS: mergedCorsOrigins.join(",") } : {}),
      ...(options.daemonListen ? { PASEO_LISTEN: options.daemonListen } : {}),
      ...(typeof options.relay === "boolean"
        ? { PASEO_RELAY_ENABLED: options.relay ? "true" : "false" }
        : {}),
    },
    cli: {
      ...(options.daemonListen ? { listen: options.daemonListen } : {}),
      ...(typeof options.relay === "boolean" ? { relayEnabled: options.relay } : {}),
    },
  };
}

export function resolveWebServerOptions(options, persisted) {
  return {
    webHost: options.webHost ?? persisted.app?.localWeb?.host ?? defaultWebHost,
    webPort: options.webPort ?? persisted.app?.localWeb?.port ?? defaultWebPort,
  };
}
