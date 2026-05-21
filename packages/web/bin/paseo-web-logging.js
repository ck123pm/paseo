export function buildLauncherLogConfig(logConfig) {
  return {
    log: {
      ...logConfig,
      file: logConfig?.file ?? { path: "daemon.log" },
    },
  };
}

export function buildLauncherStartupBanner({ webUrl, daemonEndpoint }) {
  return [
    `Paseo web running at ${webUrl}`,
    `Embedded daemon listening at ${daemonEndpoint}`,
    "Detailed logs are written to $PASEO_HOME/daemon.log.",
  ].join("\n");
}
