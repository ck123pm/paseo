import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDaemonLoadConfigOptions,
  parseArgs,
  resolveWebServerOptions,
} from "./paseo-web-options.js";

test("parseArgs leaves daemon listen unset by default", () => {
  const parsed = parseArgs(["--open"]);
  assert.equal(parsed.kind, "run");
  assert.equal(parsed.options.daemonListen, null);
  assert.equal(parsed.options.webHost, null);
  assert.equal(parsed.options.webPort, null);
  assert.equal(parsed.options.relay, null);
});

test("parseArgs captures explicit daemon listen overrides", () => {
  const parsed = parseArgs(["--daemon-listen", "0.0.0.0:7777"]);
  assert.equal(parsed.kind, "run");
  assert.equal(parsed.options.daemonListen, "0.0.0.0:7777");
});

test("buildDaemonLoadConfigOptions does not inject daemon overrides without explicit flags", () => {
  const options = buildDaemonLoadConfigOptions(
    {
      daemonListen: null,
      relay: null,
    },
    { PASEO_HOME: "C:\\tmp\\paseo" },
    {
      webHost: "127.0.0.1",
      webPort: 8081,
    },
  );

  assert.equal(options.env.PASEO_HOME, "C:\\tmp\\paseo");
  assert.equal("PASEO_LISTEN" in options.env, false);
  assert.equal("PASEO_RELAY_ENABLED" in options.env, false);
  assert.equal(options.env.PASEO_CORS_ORIGINS, "http://127.0.0.1:8081,http://localhost:8081");
  assert.equal("listen" in options.cli, false);
  assert.equal("relayEnabled" in options.cli, false);
});

test("buildDaemonLoadConfigOptions injects explicit daemon listen and relay overrides", () => {
  const options = buildDaemonLoadConfigOptions(
    {
      daemonListen: "127.0.0.1:9000",
      relay: true,
    },
    {},
    {
      webHost: "127.0.0.1",
      webPort: 5000,
    },
  );

  assert.equal(options.env.PASEO_LISTEN, "127.0.0.1:9000");
  assert.equal(options.cli.listen, "127.0.0.1:9000");
  assert.equal(options.env.PASEO_RELAY_ENABLED, "true");
  assert.equal(options.cli.relayEnabled, true);
  assert.equal(options.env.PASEO_CORS_ORIGINS, "http://127.0.0.1:5000,http://localhost:5000");
});

test("buildDaemonLoadConfigOptions preserves caller-provided CORS origins", () => {
  const options = buildDaemonLoadConfigOptions(
    {
      daemonListen: null,
      relay: null,
    },
    {
      PASEO_CORS_ORIGINS: "https://app.example.com,http://localhost:8081",
    },
    {
      webHost: "127.0.0.1",
      webPort: 8081,
    },
  );

  assert.equal(
    options.env.PASEO_CORS_ORIGINS,
    "https://app.example.com,http://localhost:8081,http://127.0.0.1:8081",
  );
});

test("resolveWebServerOptions uses persisted config when CLI host and port are unset", () => {
  const resolved = resolveWebServerOptions(
    {
      webHost: null,
      webPort: null,
    },
    {
      app: {
        localWeb: {
          host: "0.0.0.0",
          port: 4310,
        },
      },
    },
  );

  assert.deepEqual(resolved, {
    webHost: "0.0.0.0",
    webPort: 4310,
  });
});

test("resolveWebServerOptions prefers explicit CLI host and port over persisted config", () => {
  const resolved = resolveWebServerOptions(
    {
      webHost: "127.0.0.1",
      webPort: 5000,
    },
    {
      app: {
        localWeb: {
          host: "0.0.0.0",
          port: 4310,
        },
      },
    },
  );

  assert.deepEqual(resolved, {
    webHost: "127.0.0.1",
    webPort: 5000,
  });
});
