import { useCallback } from "react";
import { getDesktopHost } from "@/desktop/host";
import { pickDirectory } from "@/desktop/pick-directory";
import { useKeyboardShortcutsStore } from "@/stores/keyboard-shortcuts-store";
import { isAbsolutePath } from "@/utils/path";
import { useIsLocalDaemon } from "./use-is-local-daemon";
import { useOpenProject } from "./use-open-project";

export function useOpenProjectPicker(serverId: string | null): () => Promise<void> {
  const normalizedServerId = serverId?.trim() ?? "";
  const isLocalDaemon = useIsLocalDaemon(normalizedServerId);
  const setProjectPickerOpen = useKeyboardShortcutsStore((state) => state.setProjectPickerOpen);
  const openProject = useOpenProject(serverId);

  return useCallback(async () => {
    if (!normalizedServerId) {
      return;
    }

    const hasDialogBridge = typeof getDesktopHost()?.dialog?.open === "function";
    if (!isLocalDaemon && !hasDialogBridge) {
      setProjectPickerOpen(true);
      return;
    }

    const path = await pickDirectory();
    if (path === null) {
      return;
    }
    if (!isAbsolutePath(path)) {
      throw new Error(`Directory picker must return an absolute path. Received: ${path}`);
    }

    await openProject(path);
  }, [isLocalDaemon, normalizedServerId, openProject, setProjectPickerOpen]);
}
