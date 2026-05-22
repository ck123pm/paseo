import { beforeEach, describe, expect, it, vi } from "vitest";

const hostState = vi.hoisted(() => ({
  host: null as {
    dialog?: {
      open?: () => Promise<string | string[] | null>;
    };
  } | null,
}));

vi.mock("react-native", () => ({
  Platform: {
    OS: "web",
  },
}));

vi.mock("@/desktop/electron/host", () => ({
  getElectronHost: () => hostState.host,
}));

describe("pickDirectory", () => {
  beforeEach(() => {
    hostState.host = null;
    vi.resetModules();
  });

  it("returns a plain absolute path unchanged", async () => {
    hostState.host = {
      dialog: {
        open: async () => "D:\\work\\feature_score_split",
      },
    };

    const { pickDirectory } = await import("./pick-directory");

    await expect(pickDirectory()).resolves.toBe("D:\\work\\feature_score_split");
  });

  it("extracts the absolute path from noisy multiline dialog output", async () => {
    hostState.host = {
      dialog: {
        open: async () => "�����ѳ�ʱ��\n�����ѳ�ʱ��\nD:\\work\\feature_score_split",
      },
    };

    const { pickDirectory } = await import("./pick-directory");

    await expect(pickDirectory()).resolves.toBe("D:\\work\\feature_score_split");
  });

  it("falls back to the original selection when no absolute path can be extracted", async () => {
    hostState.host = {
      dialog: {
        open: async () => "relative/path",
      },
    };

    const { pickDirectory } = await import("./pick-directory");

    await expect(pickDirectory()).resolves.toBe("relative/path");
  });
});
