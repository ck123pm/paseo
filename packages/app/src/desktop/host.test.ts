import { beforeEach, describe, expect, it, vi } from "vitest";

const hostState = vi.hoisted(() => ({
  host: null as
    | {
        platform?: string;
        invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
        dialog?: {
          open?: () => Promise<string | null>;
        };
      }
    | null,
}));

vi.mock("react-native", () => ({
  Platform: {
    OS: "web",
  },
}));

vi.mock("@/desktop/electron/host", () => ({
  getElectronHost: () => hostState.host,
}));

describe("desktop host runtime detection", () => {
  beforeEach(() => {
    hostState.host = null;
  });

  it("keeps the lightweight paseo-web dialog bridge available without treating it as Electron", async () => {
    hostState.host = {
      dialog: {
        open: async () => null,
      },
    };

    const { getDesktopHost, isElectronRuntime } = await import("./host");

    expect(typeof getDesktopHost()?.dialog?.open).toBe("function");
    expect(isElectronRuntime()).toBe(false);
  });

  it("treats hosts with invoke as Electron", async () => {
    hostState.host = {
      invoke: async () => ({}),
    };

    const { isElectronRuntime } = await import("./host");

    expect(isElectronRuntime()).toBe(true);
  });

  it("detects mac Electron hosts from the reported platform", async () => {
    hostState.host = {
      platform: "darwin",
      invoke: async () => ({}),
    };

    const { isElectronRuntimeMac } = await import("./host");

    expect(isElectronRuntimeMac()).toBe(true);
  });
});
