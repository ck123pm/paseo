import { getDesktopHost } from "@/desktop/host";
import { isAbsolutePath } from "@/utils/path";

function extractAbsolutePathFromSelection(selection: string): string | null {
  const trimmedSelection = selection.trim();
  if (isAbsolutePath(trimmedSelection)) {
    return trimmedSelection;
  }

  const lines = trimmedSelection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (isAbsolutePath(lines[index])) {
      return lines[index];
    }
  }

  return null;
}

export function normalizePickedDirectorySelection(
  selection: string | string[] | null,
): string | null {
  if (selection === null) {
    return null;
  }

  const candidates = Array.isArray(selection) ? selection : [selection];
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const normalized = extractAbsolutePathFromSelection(candidates[index]);
    if (normalized) {
      return normalized;
    }
  }

  return Array.isArray(selection) ? (selection[0] ?? null) : selection;
}

export async function pickDirectory(): Promise<string | null> {
  const open = getDesktopHost()?.dialog?.open;
  if (typeof open !== "function") {
    throw new Error("Desktop dialog open() is unavailable in this environment.");
  }

  const selection = await open({
    directory: true,
    multiple: false,
  });

  if (selection === null) {
    return null;
  }

  return normalizePickedDirectorySelection(selection);
}
