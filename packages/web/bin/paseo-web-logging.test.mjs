import test from "node:test";
import assert from "node:assert/strict";
import { buildLauncherLogConfig } from "./paseo-web-logging.js";

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
