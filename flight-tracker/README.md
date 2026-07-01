# Thailand Open-Jaw Flugpreis-Tracker

Tägliche Preisüberwachung für eure Reise:

- **Hinflug:** Abflughafen → Bangkok (BKK), ca. 20. Januar ± einige Tage
- **Rückflug:** Phuket (HKT) → Abflughafen, ca. 4 Wochen später
- **2 Erwachsene**, Premium Economy (plus Economy zum Vergleich)
- **Abflughäfen:** HAM, CPH, FRA, MUC, BER, BLL, LBC
- **Wunsch-Airlines:** Singapore Airlines (SQ), Cathay Pacific (CX), Thai Airways (TG)

## Dashboard öffnen

Nach dem ersten Datenabruf `index.html` im Browser öffnen (oder via GitHub Pages deployen).

## Manueller Preisabruf

```bash
cd flight-tracker
pip install -r requirements.txt
python fetch_prices.py
```

## Automatische tägliche Aktualisierung

GitHub Actions Workflow `.github/workflows/flight-prices.yml` läuft täglich um 06:00 UTC und committet neue Preise in `data/history.json` und `data/latest.json`.

**GitHub Pages (optional):** Repository → Settings → Pages → Source: `main`, Folder: `/flight-tracker`

## Datenquelle

Preise stammen von Google Flights (über die [fli](https://pypi.org/project/flights/) Python-Bibliothek). Es handelt sich um Suchergebnisse zum Abrufzeitpunkt – Buchungspreise können abweichen.

## Konfiguration

Suchparameter in `config.yaml` anpassen (Termine, Flughäfen, Kabinen).
