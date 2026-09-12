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
if exist "%SRC%dienste.html" copy /Y "%SRC%dienste.html" "%DST%"
if exist "%SRC%besucher-erfassung.js" copy /Y "%SRC%besucher-erfassung.js" "%DST%"
if exist "%SRC%besucher.html" copy /Y "%SRC%besucher.html" "%DST%"
if exist "%SRC%auswertung-mobil.html" copy /Y "%SRC%auswertung-mobil.html" "%DST%"
if not exist "%DST%Historie\Besucher" mkdir "%DST%Historie\Besucher"
copy /Y "%SRC%Historie\Besucher\besucher.csv" "%DST%Historie\Besucher\"
copy /Y "%SRC%Historie\Besucher\besucher-2026-09.csv" "%DST%Historie\Besucher\"
copy /Y "%SRC%Historie\Besucher\besucher-2026-09.png" "%DST%Historie\Besucher\"
set ALIAS=\\synology\web\web\grabbuch\
if not exist "%ALIAS%" mkdir "%ALIAS%"
if exist "%ALIAS%" (
  copy /Y "%SRC%auswertung.html" "%ALIAS%"
  copy /Y "%SRC%besucher.php" "%ALIAS%"
  copy /Y "%SRC%besucher-statistik.js" "%ALIAS%"
  if exist "%SRC%dienste.html" copy /Y "%SRC%dienste.html" "%ALIAS%"
  if exist "%SRC%besucher-erfassung.js" copy /Y "%SRC%besucher-erfassung.js" "%ALIAS%"
)
echo   http://100.80.9.127/grabbuch/dienste.html
echo Fertig.
echo   http://100.80.9.127/grabbuch/auswertung.html
echo   http://100.80.9.127/web/grabbuch/auswertung.html
