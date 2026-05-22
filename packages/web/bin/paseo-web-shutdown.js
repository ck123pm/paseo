export const DEFAULT_FORCE_EXIT_TIMEOUT_MS = 5_000;
const DEFAULT_FORCE_CLOSE_CONNECTIONS_DELAY_MS = 250;

export function exitCodeForSignal(signal) {
  return signal === "SIGINT" ? 130 : 0;
}

export async function closeHttpServer(
  server,
  { forceCloseConnectionsDelayMs = DEFAULT_FORCE_CLOSE_CONNECTIONS_DELAY_MS } = {},
) {
  let didStartClose = false;
  let forceCloseTimer = null;

  const closePromise = new Promise((resolve) => {
    try {
      server.close(() => resolve(undefined));
      didStartClose = true;
    } catch {}
  });

  if (!didStartClose) {
    return;
  }

  server.closeIdleConnections?.();

  if (typeof server.closeAllConnections === "function") {
    forceCloseTimer = setTimeout(() => {
      try {
        server.closeAllConnections?.();
      } catch {}
    }, forceCloseConnectionsDelayMs);
    forceCloseTimer.unref?.();
  }

  try {
    await closePromise;
  } finally {
    if (forceCloseTimer !== null) {
      clearTimeout(forceCloseTimer);
    }
  }
}

export function createShutdownController({
  closeWebServer,
  stopDaemon,
  exit,
  logger,
  forceExitTimeoutMs = DEFAULT_FORCE_EXIT_TIMEOUT_MS,
}) {
  let shutdownStarted = false;
  let forcedExit = false;
  let forceExitTimer = null;

  function finalize(exitCode) {
    if (forcedExit) {
      return;
    }
    forcedExit = true;
    if (forceExitTimer !== null) {
      clearTimeout(forceExitTimer);
      forceExitTimer = null;
    }
    exit(exitCode);
  }

  return {
    requestShutdown({ exitCode, reason }) {
      if (shutdownStarted) {
        logger?.warn?.(
          { reason, exitCode },
          "Received another shutdown request while paseo-web cleanup is still running; forcing exit",
        );
        finalize(exitCode);
        return;
      }

      shutdownStarted = true;
      forceExitTimer = setTimeout(() => {
        logger?.warn?.(
          { reason, exitCode, forceExitTimeoutMs },
          "Timed out waiting for paseo-web shutdown; forcing exit",
        );
        finalize(exitCode);
      }, forceExitTimeoutMs);
      forceExitTimer.unref?.();

      void (async () => {
        try {
          await closeWebServer().catch(() => undefined);
          await stopDaemon().catch(() => undefined);
          finalize(exitCode);
        } catch (error) {
          logger?.error?.({ err: error, reason }, "paseo-web shutdown failed");
          finalize(exitCode === 0 ? 1 : exitCode);
        }
      })();
    },
  };
}
