# `@ck123pm/paseo-web`

Install and run the packaged Paseo web app locally with an embedded daemon.

Publish `@ck123pm/paseo-server` first. This launcher installs and imports the server package at runtime.

## Usage

Run without installing:

```bash
npx @ck123pm/paseo-web --open
```

Install globally:

```bash
npm install -g @ck123pm/paseo-web
paseo-web --open
```

Options:

- `--host <host>`: bind host, overrides `app.localWeb.host` in `$PASEO_HOME/config.json` or falls back to `127.0.0.1`
- `--port <port>`: bind port, overrides `app.localWeb.port` in `$PASEO_HOME/config.json` or falls back to `8081`
- `--daemon-listen <host:port>`: embedded daemon listen target, overrides `daemon.listen` in `$PASEO_HOME/config.json`
- `--home <path>`: Paseo home directory
- `--open`: open the browser automatically
- `--relay`: enable Paseo relay for the embedded daemon, overriding `$PASEO_HOME/config.json`

This package starts both the web client and a local embedded daemon in the same launcher process.

On startup the launcher prints the web and embedded daemon listen addresses once to the terminal.
Detailed launcher and daemon logs are written to `$PASEO_HOME/daemon.log`.

If you do not pass `--host`, `--port`, `--daemon-listen`, or `--relay`, the
launcher reads from `$PASEO_HOME/config.json` first:

```json
{
  "version": 1,
  "daemon": {
    "listen": "0.0.0.0:6767",
    "relay": {
      "enabled": true
    },
    "workspaces": {
      "git": {
        "backgroundFetchIntervalMs": 900000,
        "selfHealIntervalMs": 300000,
        "workingTreeWatchFallbackRefreshMs": 60000
      },
      "reconcileIntervalMs": 300000
    }
  },
  "app": {
    "localWeb": {
      "host": "127.0.0.1",
      "port": 8081
    }
  }
}
```

- `daemon.listen`: embedded daemon bind address. Use `127.0.0.1:6767` for same-machine access only, or `0.0.0.0:6767` for direct connections from other devices on your LAN.
- `daemon.relay.enabled`: relay default when `--relay` is omitted.
- `daemon.workspaces.git.backgroundFetchIntervalMs`: background git fetch cadence in milliseconds. Default `900000` (15 min).
- `daemon.workspaces.git.selfHealIntervalMs`: cadence for workspace git self-heal checks. Default `300000` (5 min).
- `daemon.workspaces.git.workingTreeWatchFallbackRefreshMs`: fallback refresh cadence when file watching is unavailable. Default `60000` (1 min).
- `daemon.workspaces.reconcileIntervalMs`: workspace reconcile cadence. Default `300000` (5 min).
- `app.localWeb.host` / `app.localWeb.port`: packaged web launcher bind address when `--host` / `--port` are omitted.
- `--home <path>` switches the launcher to another `PASEO_HOME`, so it will read that directory's `config.json` instead.

When the `paseo-web` process stops, the embedded daemon is stopped too.

Closing only the browser tab does not reliably stop the launcher process.

Before publishing, verify the packed artifacts locally from the repo root:

```bash
npm run smoke:web-package
```
