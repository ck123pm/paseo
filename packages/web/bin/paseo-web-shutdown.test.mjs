import test from "node:test";
import assert from "node:assert/strict";
import {
  closeHttpServer,
  createShutdownController,
  exitCodeForSignal,
} from "./paseo-web-shutdown.js";

test("exitCodeForSignal returns 130 for SIGINT", () => {
  assert.equal(exitCodeForSignal("SIGINT"), 130);
  assert.equal(exitCodeForSignal("SIGTERM"), 0);
});

test("closeHttpServer closes idle connections and force-closes active ones", async () => {
  let closeIdleConnectionsCalled = 0;
  let closeAllConnectionsCalled = 0;

  const closePromise = closeHttpServer(
    {
      close(callback) {
        setTimeout(() => callback(), 20);
      },
      closeIdleConnections() {
        closeIdleConnectionsCalled += 1;
      },
      closeAllConnections() {
        closeAllConnectionsCalled += 1;
      },
    },
    { forceCloseConnectionsDelayMs: 0 },
  );

  await closePromise;

  assert.equal(closeIdleConnectionsCalled, 1);
  assert.equal(closeAllConnectionsCalled, 1);
});

test("shutdown controller exits after graceful cleanup finishes", async () => {
  const exitCalls = [];

  const shutdown = createShutdownController({
    closeWebServer: async () => {},
    stopDaemon: async () => {},
    exit: (code) => exitCalls.push(code),
    logger: null,
    forceExitTimeoutMs: 50,
  });

  shutdown.requestShutdown({ exitCode: 130, reason: "signal:SIGINT" });
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.deepEqual(exitCalls, [130]);
});

test("shutdown controller forces exit immediately on repeated interrupt", async () => {
  const exitCalls = [];
  let releaseStopDaemon;
  const stopDaemon = new Promise((resolve) => {
    releaseStopDaemon = resolve;
  });

  const shutdown = createShutdownController({
    closeWebServer: async () => {},
    stopDaemon: async () => stopDaemon,
    exit: (code) => exitCalls.push(code),
    logger: { warn() {} },
    forceExitTimeoutMs: 1_000,
  });

  shutdown.requestShutdown({ exitCode: 130, reason: "signal:SIGINT" });
  shutdown.requestShutdown({ exitCode: 130, reason: "signal:SIGINT" });
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.deepEqual(exitCalls, [130]);
  releaseStopDaemon();
});

test("shutdown controller forces exit after timeout when cleanup hangs", async () => {
  const exitCalls = [];

  const shutdown = createShutdownController({
    closeWebServer: async () => {},
    stopDaemon: async () => new Promise(() => {}),
    exit: (code) => exitCalls.push(code),
    logger: { warn() {} },
    forceExitTimeoutMs: 10,
  });

  shutdown.requestShutdown({ exitCode: 130, reason: "signal:SIGINT" });
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.deepEqual(exitCalls, [130]);
});
