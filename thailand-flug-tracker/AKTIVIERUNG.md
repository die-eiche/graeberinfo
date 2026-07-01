# Flight-Tracker aktivieren (einmalig)

GitHub Pages kann vom Cursor-Agenten **nicht automatisch** aktiviert werden – dafür braucht es **Admin-Rechte** am Repository.

## Dauerhafte Lösung (2 Minuten, einmalig)

1. Repository-Einstellungen → **Pages** öffnen  
   *(z. B. `https://github.com/die-eiche/thailand-flug-tracker/settings/pages` – nur sichtbar als Besitzer)*

2. **Build and deployment:**
   - Source: **GitHub Actions**

3. Speichern – der Workflow **„Thailand Flug-Tracker Dashboard (GitHub Pages)“** deployt dann automatisch bei jedem Push auf `main`.

4. Nach 1–2 Minuten ist das Dashboard erreichbar unter der Pages-URL des Repositories (z. B.):
   **`https://die-eiche.github.io/thailand-flug-tracker/`**

Falls der Workflow fehlschlägt: unter **Actions** den letzten „Thailand Flug-Tracker Dashboard“-Lauf prüfen.

## Tägliche Preis-Updates

Unter **Actions** → **„Tägliche Flugpreis-Aktualisierung“** → **Run workflow** (einmalig manuell starten, danach täglich automatisch).

## Auslagerung aus GraeberInfo

Dieser Vorgang war zuvor unter `graeberinfo/flight-tracker` eingebunden. Für ein eigenes Repository:

```bash
git clone --depth 1 -b main https://github.com/die-eiche/graeberinfo.git temp
cp -r temp/thailand-flug-tracker/* .
# oder: neues Repo anlegen und nur den Ordner thailand-flug-tracker pushen
```
