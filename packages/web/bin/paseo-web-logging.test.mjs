import test from "node:test";
import assert from "node:assert/strict";
import { buildLauncherLogConfig, buildLauncherStartupBanner } from "./paseo-web-logging.js";

test("paseo-web launcher defaults to daemon.log file output", () => {
  assert.deepEqual(buildLauncherLogConfig(undefined), {
    log: {
      file: {
        path: "daemon.log",
      },
    },
  });
});

test("paseo-web launcher preserves explicit file log settings", () => {
  const configured = buildLauncherLogConfig({
    level: "info",
    format: "pretty",
    console: {
      level: "warn",
      format: "pretty",
    },
    file: {
      level: "debug",
      path: "logs/web.log",
    },
  });

  assert.deepEqual(configured, {
    log: {
      level: "info",
      format: "pretty",
      console: {
        level: "warn",
        format: "pretty",
      },
      file: {
        level: "debug",
        path: "logs/web.log",
      },
    },
  });
});

test("paseo-web launcher keeps a one-time startup banner for the terminal", () => {
  assert.equal(
    buildLauncherStartupBanner({
      webUrl: "http://127.0.0.1:8081",
      daemonEndpoint: "127.0.0.1:6767",
    }),
    [
      "Paseo web running at http://127.0.0.1:8081",
      "Embedded daemon listening at 127.0.0.1:6767",
      "Detailed logs are written to $PASEO_HOME/daemon.log.",
    ].join("\n"),
  );
});
