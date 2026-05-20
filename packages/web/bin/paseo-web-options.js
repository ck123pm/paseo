const defaultWebHost = "127.0.0.1";
const defaultWebPort = 4173;

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

export function buildDaemonLoadConfigOptions(options, daemonHomeEnv) {
  return {
    env: {
      ...daemonHomeEnv,
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
