# `@ck123pm/paseo-web`

Install and run the packaged Paseo web app locally with an embedded daemon.

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

- `--host <host>`: bind host, default `127.0.0.1`
- `--port <port>`: bind port, default `4173`
- `--daemon-listen <host:port>`: embedded daemon listen target, default `127.0.0.1:6767`
- `--home <path>`: Paseo home directory
- `--open`: open the browser automatically
- `--relay`: enable Paseo relay for the embedded daemon

This package starts both the web client and a local embedded daemon in the same launcher process.

When the `paseo-web` process stops, the embedded daemon is stopped too.

Closing only the browser tab does not reliably stop the launcher process.
