import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import path from "path";
import { SYSTEM_PROMPT } from "./systemPrompt";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

const PORT = Number(process.env.PORT || 8787);
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";
const EXTRACT_MODEL = process.env.MISTRAL_EXTRACT_MODEL || "open-mistral-nemo";
const TRANSCRIBE_MODEL = process.env.MISTRAL_TRANSCRIBE_MODEL || "voxtral-mini-latest";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

type SessionState = {
  noteMarkdown: string;
  title: string;
};

const sessions = new Map<string, SessionState>();

function requireApiKey(res: express.Response): string | null {
  if (!MISTRAL_API_KEY) {
    res.status(500).json({
      error: "MISTRAL_API_KEY fehlt auf dem Server.",
    });
    return null;
  }
  return MISTRAL_API_KEY;
}

function parseNote(raw: string): { title: string; body: string } {
  const lines = raw.trim().split(/\r?\n/);
  const title = (lines[0] || "Aufnahme").trim() || "Aufnahme";
  const body = lines.slice(1).join("\n").trim();
  return { title, body };
}

async function extractFromTranscript(
  apiKey: string,
  sessionId: string,
  transcript: string,
  previousNote: string
): Promise<{ title: string; noteMarkdown: string; raw: string }> {
  const userContent = [
    `Session-ID: ${sessionId}`,
    "Bisheriger Stand (falls vorhanden):",
    previousNote || "",
    "",
    "Neuer Gesprächsabschnitt:",
    transcript,
    "",
    "Aktualisiere den Stand gemäß Systemregeln und gib Titel + vollständige Tabelle aus.",
  ].join("\n");

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Extraktion fehlgeschlagen (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  const { title, body } = parseNote(raw);
  const noteMarkdown = `${title}\n\n${body}`.trim() + "\n";
  return { title, noteMarkdown, raw };
}

async function transcribeAudio(
  apiKey: string,
  fileBuffer: Buffer,
  fileName: string
): Promise<string> {
  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("language", "de");
  form.append(
    "file",
    new Blob([new Uint8Array(fileBuffer)]),
    fileName || "segment.m4a"
  );

  const response = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transkription fehlgeschlagen (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { text?: string };
  return (data.text || "").trim();
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(MISTRAL_API_KEY),
    extractModel: EXTRACT_MODEL,
    transcribeModel: TRANSCRIBE_MODEL,
  });
});

app.post("/session/start", (req, res) => {
  const sessionId = String(req.body?.sessionId || `s-${Date.now()}`);
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      title: "Aufnahme",
      noteMarkdown: "Aufnahme\n\n| Feld | Wert |\n|---|---|\n",
    });
  }
  const state = sessions.get(sessionId)!;
  res.json({ sessionId, title: state.title, noteMarkdown: state.noteMarkdown });
});

app.post("/session/segment-text", async (req, res) => {
  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  const sessionId = String(req.body?.sessionId || "");
  const transcript = String(req.body?.transcript || "").trim();
  if (!sessionId || !transcript) {
    res.status(400).json({ error: "sessionId und transcript sind erforderlich." });
    return;
  }

  const state = sessions.get(sessionId) || {
    title: "Aufnahme",
    noteMarkdown: "",
  };

  try {
    const result = await extractFromTranscript(
      apiKey,
      sessionId,
      transcript,
      state.noteMarkdown
    );
    sessions.set(sessionId, {
      title: result.title,
      noteMarkdown: result.noteMarkdown,
    });
    res.json({
      sessionId,
      title: result.title,
      noteMarkdown: result.noteMarkdown,
      transcript,
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Unbekannter Fehler",
    });
  }
});

app.post("/session/segment-audio", upload.single("audio"), async (req, res) => {
  const apiKey = requireApiKey(res);
  if (!apiKey) return;

  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId || !req.file) {
    res.status(400).json({ error: "sessionId und audio sind erforderlich." });
    return;
  }

  const state = sessions.get(sessionId) || {
    title: "Aufnahme",
    noteMarkdown: "",
  };

  try {
    const transcript = await transcribeAudio(
      apiKey,
      req.file.buffer,
      req.file.originalname || "segment.m4a"
    );

    if (!transcript) {
      res.json({
        sessionId,
        title: state.title,
        noteMarkdown: state.noteMarkdown,
        transcript: "",
        skipped: true,
      });
      return;
    }

    const result = await extractFromTranscript(
      apiKey,
      sessionId,
      transcript,
      state.noteMarkdown
    );
    sessions.set(sessionId, {
      title: result.title,
      noteMarkdown: result.noteMarkdown,
    });
    res.json({
      sessionId,
      title: result.title,
      noteMarkdown: result.noteMarkdown,
      transcript,
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Unbekannter Fehler",
    });
  }
});

app.post("/session/stop", (req, res) => {
  const sessionId = String(req.body?.sessionId || "");
  const state = sessions.get(sessionId);
  if (sessionId) sessions.delete(sessionId);
  res.json({
    sessionId,
    title: state?.title || "Aufnahme",
    noteMarkdown: state?.noteMarkdown || "",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Aufnahme-API auf http://0.0.0.0:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`API-Key geladen: ${MISTRAL_API_KEY ? "ja" : "nein"}`);
});
