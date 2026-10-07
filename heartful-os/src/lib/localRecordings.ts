import path from "path";

// Folder for recordings saved by the LOCAL demo copy (no Firebase). Kept
// beside the app and gitignored. Returns null for any path that would escape
// the folder.
export const LOCAL_RECORDINGS_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), ".local-recordings");

export function localRecordingFilePath(relative: string): string | null {
  if (!relative || relative.includes("\0")) return null;
  const resolved = path.resolve(LOCAL_RECORDINGS_DIR, relative);
  return resolved.startsWith(LOCAL_RECORDINGS_DIR + path.sep) ? resolved : null;
}
