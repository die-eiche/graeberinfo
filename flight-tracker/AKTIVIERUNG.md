# Flight-Tracker aktivieren (einmalig)

GitHub Pages kann vom Cursor-Agenten **nicht automatisch** aktiviert werden – dafür braucht es **Admin-Rechte** am Repository.

## Dauerhafte Lösung (2 Minuten, einmalig)

1. https://github.com/die-eiche/graeberinfo/settings/pages öffnen  
   *(nur sichtbar, wenn ihr Repository-Besitzer seid)*

2. **Build and deployment:**
   - Source: **GitHub Actions**

3. Speichern – der Workflow **„Flight-Tracker Dashboard (GitHub Pages)“** deployt dann automatisch bei jedem Push auf `main`.

4. Nach 1–2 Minuten ist das Dashboard erreichbar unter:
   **`https://die-eiche.github.io/graeberinfo/`**

Falls der Workflow fehlschlägt: unter **Actions** den letzten „Flight-Tracker Dashboard“-Lauf prüfen.

## Tägliche Preis-Updates

Unter **Actions** → **„Tägliche Flugpreis-Aktualisierung“** → **Run workflow** (einmalig manuell starten, danach täglich automatisch).
