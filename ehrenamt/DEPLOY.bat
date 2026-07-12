@echo off
chcp 65001 >nul
echo ============================================
echo  Ehrenamt Deploy auf Synology (G:\Ehrenamt)
echo ============================================
echo.

if not exist "G:\Ehrenamt" (
    echo FEHLER: G:\Ehrenamt nicht gefunden.
    echo Bitte NAS verbinden und erneut starten.
    pause
    exit /b 1
)

if not exist "G:\ehrenamt\EA Dienste 2026.xlsx" (
    echo WARNUNG: Excel nicht gefunden unter G:\ehrenamt\
)

echo [1/3] Dateien kopieren...
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-zum-nas.ps1"
if errorlevel 1 (
    echo FEHLER beim Kopieren.
    pause
    exit /b 1
)

echo.
echo [2/3] Fertig kopiert nach G:\Ehrenamt\
echo.
echo [3/3] Container neu starten...
echo.
echo Bitte jetzt in Synology DSM:
echo   Container Manager -^> Projekt ehrenamt-abfrage -^> Neu starten
echo   (oder Projekt neu erstellen mit Pfad G:\Ehrenamt\Abfrage)
echo.
echo Test danach im Browser:
echo   http://100.80.9.127:3080/api/dienste
echo.
pause
