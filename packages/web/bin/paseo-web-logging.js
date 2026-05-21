export function buildLauncherLogConfig(logConfig) {
  return {
    log: {
      ...logConfig,
      file: logConfig?.file ?? { path: "daemon.log" },
    },
  };
}
