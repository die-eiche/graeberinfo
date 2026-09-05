import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const NOTES_DIR = `${FileSystem.documentDirectory}notizen/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(NOTES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(NOTES_DIR, { intermediates: true });
  }
}

function safeFileName(title: string) {
  return title.replace(/[\\/:*?"<>|]/g, "_").trim() || "Aufnahme";
}

/**
 * Schreibt/aktualisiert die Notiz als Markdown-Datei auf dem Gerät.
 * Beim Umbenennen (Titelwechsel) wird die alte Datei entfernt.
 * Export in die System-Notizen-App erfolgt über die Share-Sheet (iOS/Android).
 */
export async function upsertNoteFile(
  previousPath: string | null,
  title: string,
  noteMarkdown: string
): Promise<string> {
  await ensureDir();
  const nextPath = `${NOTES_DIR}${safeFileName(title)}.md`;

  if (previousPath && previousPath !== nextPath) {
    const prev = await FileSystem.getInfoAsync(previousPath);
    if (prev.exists) {
      await FileSystem.deleteAsync(previousPath, { idempotent: true });
    }
  }

  await FileSystem.writeAsStringAsync(nextPath, noteMarkdown, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return nextPath;
}

export async function shareNoteToSystemNotes(filePath: string) {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
  }
  await Sharing.shareAsync(filePath, {
    mimeType: "text/markdown",
    dialogTitle: "In Notizen speichern",
    UTI: "public.plain-text",
  });
}
