import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { loadConfig } from "./config.js";

const roots: string[] = [];

async function createPaseoHome(config: unknown): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "paseo-config-workspaces-"));
  roots.push(root);
  const paseoHome = path.join(root, ".paseo");
  await mkdir(paseoHome, { recursive: true });
  await writeFile(path.join(paseoHome, "config.json"), JSON.stringify(config, null, 2));
  return paseoHome;
}

describe("daemon workspace polling config", () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  test("uses new default workspace polling intervals when config is omitted", async () => {
    const paseoHome = await createPaseoHome({ version: 1, daemon: {} });

    const config = loadConfig(paseoHome, { env: {} });

    expect(config.workspacePolling).toEqual({
      git: {
        backgroundFetchIntervalMs: 900_000,
        selfHealIntervalMs: 300_000,
        workingTreeWatchFallbackRefreshMs: 60_000,
      },
      reconcileIntervalMs: 300_000,
    });
  });

  test("maps persisted workspace polling intervals into runtime config", async () => {
    const paseoHome = await createPaseoHome({
      version: 1,
      daemon: {
        workspaces: {
          git: {
            backgroundFetchIntervalMs: 111_000,
            selfHealIntervalMs: 222_000,
            workingTreeWatchFallbackRefreshMs: 333_000,
          },
          reconcileIntervalMs: 444_000,
        },
      },
    });

    const config = loadConfig(paseoHome, { env: {} });

    expect(config.workspacePolling).toEqual({
      git: {
        backgroundFetchIntervalMs: 111_000,
        selfHealIntervalMs: 222_000,
        workingTreeWatchFallbackRefreshMs: 333_000,
      },
      reconcileIntervalMs: 444_000,
    });
  });
});
