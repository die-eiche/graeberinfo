#!/usr/bin/env python3
"""Live-Test: Aufnahme-System-Prompt gegen Mistral API.

Voraussetzung:
  export MISTRAL_API_KEY=...

Aufruf:
  python3 scripts/test_aufnahme_mistral.py
  python3 scripts/test_aufnahme_mistral.py --model mistral-small-latest
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROMPT_PATH = Path(__file__).resolve().parents[1] / "docs" / "aufnahme" / "system-prompt.md"
API_URL = "https://api.mistral.ai/v1/chat/completions"

SAMPLE_ABSCHEITT = """
Mitarbeiter: Willkommen in der Eiche. Hier wäre das Grab 2.01.03.01.04.
Kunde: Das nehmen wir. Ich heiße Thomas Berger, bin der Sohn des Verstorbenen.
Mitarbeiter: Ihre Adresse und Telefonnummer bitte.
Kunde: Waldstraße 12, 60318 Frankfurt. Telefon 069 1234567, E-Mail t.berger@example.com.
Kunde: Bezahlen möchte ich per SEPA. IBAN DE89 3704 0044 0532 0130 00, Kontoinhaber Thomas Berger.
Kunde: Mein Vater war Klaus Berger, geboren am 12.03.1942, verstorben am 28.08.2026.
Kunde: Adresse vom Vater: ebenfalls Waldstraße 12, 60318 Frankfurt.
Mitarbeiter: Welcher Bestatter?
Kunde: Bestattung Hofmann, Aufwand ist schon geklärt.
Kunde: Urne soll schlicht weiß sein. Trauerfeier am Freitag Nachmittag, eher ruhig und ohne große Rede.
"""


def extract_system_prompt(markdown: str) -> str:
    marker = "```text\n"
    start = markdown.find(marker)
    if start < 0:
        raise ValueError("System-Prompt-Block nicht gefunden")
    start += len(marker)
    end = markdown.find("\n```", start)
    if end < 0:
        raise ValueError("Ende des System-Prompt-Blocks nicht gefunden")
    return markdown[start:end].strip()


def call_mistral(api_key: str, model: str, system_prompt: str, user_content: str) -> str:
    payload = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="mistral-large-latest")
    args = parser.parse_args()

    api_key = os.environ.get("MISTRAL_API_KEY", "").strip()
    if not api_key:
        print(
            "MISTRAL_API_KEY fehlt.\n"
            "1) Konto: https://console.mistral.ai\n"
            "2) API-Key erzeugen\n"
            "3) export MISTRAL_API_KEY='...'\n"
            "Danach dieses Skript erneut ausführen.",
            file=sys.stderr,
        )
        return 2

    system_prompt = extract_system_prompt(PROMPT_PATH.read_text(encoding="utf-8"))
    user_content = (
        "Session-ID: demo-001\n"
        "Bisheriger Stand (falls vorhanden):\n"
        "\n"
        "Neuer Gesprächsabschnitt:\n"
        f"{SAMPLE_ABSCHEITT.strip()}\n\n"
        "Aktualisiere den Stand gemäß Systemregeln und gib Titel + vollständige Tabelle aus."
    )

    try:
        result = call_mistral(api_key, args.model, system_prompt, user_content)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"Mistral HTTP {exc.code}: {body}", file=sys.stderr)
        return 1

    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
