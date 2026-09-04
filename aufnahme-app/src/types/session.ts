export type SessionStatus = "idle" | "recording" | "paused" | "stopped";

export type NoteSnapshot = {
  title: string;
  noteMarkdown: string;
};
