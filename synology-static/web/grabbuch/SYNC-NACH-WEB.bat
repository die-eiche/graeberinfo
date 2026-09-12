@echo off
REM Kopiert die Besucherstatistik von G:\Grabbuch (public) nach \\synology\web\grabbuch
set SRC=%~dp0
set DST=\\synology\web\grabbuch\
if not exist "%DST%" set DST=\\100.80.9.127\web\grabbuch\
if not exist "%DST%" (
  echo Web-Freigabe nicht erreichbar: %DST%
  echo Bitte \\synology\web\grabbuch verbinden und erneut ausfuehren.
  exit /b 1
)
copy /Y "%SRC%auswertung.html" "%DST%"
copy /Y "%SRC%besucher.php" "%DST%"
copy /Y "%SRC%besucher-statistik.js" "%DST%"
if not exist "%DST%Historie\Besucher" mkdir "%DST%Historie\Besucher"
copy /Y "%SRC%Historie\Besucher\besucher.csv" "%DST%Historie\Besucher\"
copy /Y "%SRC%Historie\Besucher\besucher-2026-09.csv" "%DST%Historie\Besucher\"
copy /Y "%SRC%Historie\Besucher\besucher-2026-09.png" "%DST%Historie\Besucher\"
echo Fertig. Seite neu laden: http://100.80.9.127/grabbuch/auswertung.html
