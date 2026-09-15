<?php
/**
 * Besucherstatistik: Lesen, Anhängen, Demo-Leerung, monatliche Sicherung.
 *
 * GET  action=load     → JSON { rows, demo, wiped, source }
 * POST action=append   → { kategorie, anzahl, zeitstempel? }
 *   kategorie: hinterbliebene | hausfuehrung | grabverkauf
 *   anzahl: 1–30; jeder Eintrag genau eine Gruppe.
 * POST action=snapshot → { png: data-url oder base64, month: YYYY-MM }
 *
 * Ab 1.1.2027 00:00 (Europe/Berlin) werden Demo-Daten geleert
 * (sofort oder beim nächsten Zugriff). Danach kumulativ.
 * Aufnahme über dienste.html (POST append, Long-Press auf einen Tag).
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const BESUCHER_CUTOFF = '2027-01-01 00:00:00';
const BESUCHER_TZ = 'Europe/Berlin';
const BESUCHER_LABELS = [
    'hinterbliebene' => 'Hinterbliebene',
    'hausfuehrung' => 'Hausführung',
    'grabverkauf' => 'Grabverkauf',
];

function besucher_now(): DateTimeImmutable
{
    return new DateTimeImmutable('now', new DateTimeZone(BESUCHER_TZ));
}

function besucher_pull_public_webfiles(): void
{
    $public = '/volume1/public/Grabbuch';
    if (!is_dir($public)) {
        return;
    }
    $names = [
        'auswertung.html', 'auswertung-mobil.html', 'besucher.html',
        'besucher.php', 'besucher-statistik.js', 'dienste.html', 'besucher-erfassung.js',
    ];
    foreach ($names as $name) {
        $src = $public . DIRECTORY_SEPARATOR . $name;
        $dst = __DIR__ . DIRECTORY_SEPARATOR . $name;
        if (!is_file($src)) {
            continue;
        }
        if (!is_file($dst) || filemtime($src) > filemtime($dst) || filesize($src) !== filesize($dst)) {
            @copy($src, $dst);
        }
    }
}

function besucher_publish_http_alias(): void
{
    $grab = __DIR__;
    $alias = dirname($grab) . DIRECTORY_SEPARATOR . 'web' . DIRECTORY_SEPARATOR . 'grabbuch';
    if (!is_dir($alias) && !@mkdir($alias, 0777, true) && !is_dir($alias)) {
        return;
    }
    $names = [
        'auswertung.html', 'auswertung-mobil.html', 'besucher.html',
        'besucher.php', 'besucher-statistik.js', 'dienste.html', 'besucher-erfassung.js',
        'chart.umd.min.js', 'statistik-icon.png',
    ];
    foreach ($names as $name) {
        $src = $grab . DIRECTORY_SEPARATOR . $name;
        if (is_file($src)) {
            @copy($src, $alias . DIRECTORY_SEPARATOR . $name);
        }
    }
}

function besucher_dirs(): array
{
    $dirs = [__DIR__ . DIRECTORY_SEPARATOR . 'Historie' . DIRECTORY_SEPARATOR . 'Besucher'];
    $public = '/volume1/public/Grabbuch/Historie/Besucher';
    if (is_dir('/volume1/public/Grabbuch') || is_dir($public)) {
        $dirs[] = $public;
    }
    $out = [];
    foreach ($dirs as $dir) {
        if (!in_array($dir, $out, true)) {
            $out[] = $dir;
        }
    }
    return $out;
}

function besucher_ensure_dir(string $dir): void
{
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

function besucher_csv_path(string $dir): string
{
    return $dir . DIRECTORY_SEPARATOR . 'besucher.csv';
}

function besucher_read_raw(string $path): string
{
    if (!is_file($path)) {
        return '';
    }
    $raw = file_get_contents($path);
    return $raw === false ? '' : $raw;
}

function besucher_is_demo(string $raw): bool
{
    if (strncmp($raw, "\xEF\xBB\xBF", 3) === 0) {
        $raw = substr($raw, 3);
    }
    return (bool) preg_match('/^[#;].*DEMO\s*=\s*1/mi', $raw);
}

function besucher_empty_csv(bool $demo): string
{
    $out = "\xEF\xBB\xBF";
    if ($demo) {
        $out .= "# DEMO=1; Fantasiewerte zum Spielen, Leerung am 1.1.2027 00:00 Europe/Berlin\n";
    }
    $out .= "Kategorie;Anzahl;Zeitstempel\n";
    return $out;
}

function besucher_normalize_kategorie(string $raw): ?string
{
    $k = mb_strtolower(trim($raw), 'UTF-8');
    $k = strtr($k, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
    $map = [
        'hinterbliebene' => 'hinterbliebene',
        'grabbesucher' => 'hinterbliebene',
        'hausfuehrung' => 'hausfuehrung',
        'hausfuhrung' => 'hausfuehrung',
        'fuehrung' => 'hausfuehrung',
        'grabverkauf' => 'grabverkauf',
        'interessenten' => 'grabverkauf',
        'interessent' => 'grabverkauf',
        'kategorie' => null,
    ];
    return $map[$k] ?? null;
}

function besucher_row(string $kategorie, int $anzahl, string $ts): array
{
    $row = [
        'kategorie' => $kategorie,
        'anzahl' => $anzahl,
        'label' => BESUCHER_LABELS[$kategorie] ?? $kategorie,
        'zeitstempel' => $ts,
        'hinterbliebene' => 0,
        'hausfuehrung' => 0,
        'grabverkauf' => 0,
    ];
    $row[$kategorie] = $anzahl;
    return $row;
}

function besucher_parse_rows(string $raw): array
{
    if (strncmp($raw, "\xEF\xBB\xBF", 3) === 0) {
        $raw = substr($raw, 3);
    }
    $rows = [];
    $lines = preg_split("/\r\n|\n|\r/", $raw);
    $headerSeen = false;
    foreach ($lines as $line) {
        $trim = trim($line);
        if ($trim === '' || strpos($trim, '#') === 0) {
            continue;
        }
        $parts = explode(';', $line);
        $first = strtolower(trim(strtr($parts[0] ?? '', ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue'])));
        if (!$headerSeen && in_array($first, ['interessenten', 'zeitstempel', 'kategorie', 'hinterbliebene'], true)) {
            $headerSeen = true;
            continue;
        }
        if (count($parts) < 3) {
            continue;
        }
        $ts = trim($parts[count($parts) - 1]);
        if ($ts === '') {
            continue;
        }
        $kat = besucher_normalize_kategorie(trim($parts[0]));
        if ($kat !== null) {
            $n = (int) trim($parts[1]);
            if ($n > 0) {
                $rows[] = besucher_row($kat, $n, $ts);
            }
            continue;
        }
        $int = (int) trim($parts[0]);
        $grab = (int) trim($parts[1]);
        if ($grab > 0) {
            $rows[] = besucher_row('hinterbliebene', $grab, $ts);
        }
        if ($int > 0) {
            $rows[] = besucher_row('grabverkauf', $int, $ts);
        }
    }
    return $rows;
}

function besucher_write_csv(string $path, array $rows, bool $demo): void
{
    $tmp = $path . '.tmp';
    $fh = fopen($tmp, 'w');
    if ($fh === false) {
        throw new RuntimeException('CSV nicht schreibbar: ' . $path);
    }
    fwrite($fh, besucher_empty_csv($demo));
    foreach ($rows as $row) {
        $kat = (string) ($row['kategorie'] ?? '');
        if ($kat === '' || !isset(BESUCHER_LABELS[$kat])) {
            continue;
        }
        $n = (int) ($row['anzahl'] ?? $row[$kat] ?? 0);
        if ($n <= 0) {
            continue;
        }
        fwrite(
            $fh,
            BESUCHER_LABELS[$kat] . ';' .
            $n . ';' .
            str_replace(["\r", "\n", ';'], ['', '', ','], (string) $row['zeitstempel']) . "\n"
        );
    }
    fclose($fh);
    rename($tmp, $path);
}

function besucher_primary_dir(): string
{
    $dirs = besucher_dirs();
    foreach ($dirs as $dir) {
        besucher_ensure_dir($dir);
        $path = besucher_csv_path($dir);
        if (is_file($path) || is_writable($dir)) {
            return $dir;
        }
    }
    return $dirs[0];
}

function besucher_load_state(): array
{
    $primary = besucher_primary_dir();
    $path = besucher_csv_path($primary);
    $raw = besucher_read_raw($path);
    if ($raw === '') {
        foreach (besucher_dirs() as $dir) {
            $alt = besucher_read_raw(besucher_csv_path($dir));
            if ($alt !== '') {
                $raw = $alt;
                $primary = $dir;
                $path = besucher_csv_path($dir);
                break;
            }
        }
    }
    $demo = $raw === '' ? true : besucher_is_demo($raw);
    $rows = besucher_parse_rows($raw);
    return compact('primary', 'path', 'raw', 'demo', 'rows');
}

function besucher_cutoff_reached(): bool
{
    return besucher_now() >= new DateTimeImmutable(BESUCHER_CUTOFF, new DateTimeZone(BESUCHER_TZ));
}

function besucher_sync_all(array $rows, bool $demo): void
{
    foreach (besucher_dirs() as $dir) {
        besucher_ensure_dir($dir);
        besucher_write_csv(besucher_csv_path($dir), $rows, $demo);
    }
}

function besucher_ensure_wipe(array $state): array
{
    $wiped = false;
    if ($state['demo'] && besucher_cutoff_reached()) {
        $state['rows'] = [];
        $state['demo'] = false;
        $state['raw'] = besucher_empty_csv(false);
        besucher_sync_all([], false);
        $wiped = true;
    } elseif ($state['raw'] === '') {
        besucher_sync_all($state['rows'], $state['demo']);
    }
    $state['wiped'] = $wiped;
    return $state;
}

function besucher_parse_body(): array
{
    $raw = file_get_contents('php://input');
    $json = json_decode($raw ?: '[]', true);
    if (!is_array($json)) {
        $json = [];
    }
    return array_merge($_POST, $json);
}

function besucher_normalize_ts(?string $ts): string
{
    $tz = new DateTimeZone(BESUCHER_TZ);
    if ($ts) {
        $ts = str_replace('T', ' ', trim($ts));
        $dt = DateTimeImmutable::createFromFormat('Y-m-d H:i', substr($ts, 0, 16), $tz)
            ?: DateTimeImmutable::createFromFormat('Y-m-d H', substr($ts, 0, 13), $tz)
            ?: DateTimeImmutable::createFromFormat('d.m.Y H:i', $ts, $tz);
        if ($dt instanceof DateTimeImmutable) {
            return $dt->format('Y-m-d H:00');
        }
    }
    return besucher_now()->format('Y-m-d H:00');
}

function besucher_save_snapshot(string $month, string $png): array
{
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        $month = besucher_now()->format('Y-m');
    }
    if (strpos($png, 'data:') === 0) {
        $png = preg_replace('/^data:image\/\w+;base64,/', '', $png) ?? $png;
    }
    $bin = base64_decode($png, true);
    if ($bin === false || strlen($bin) < 32) {
        throw new RuntimeException('Ungültiges PNG');
    }
    $saved = [];
    foreach (besucher_dirs() as $dir) {
        besucher_ensure_dir($dir);
        $pngPath = $dir . DIRECTORY_SEPARATOR . 'besucher-' . $month . '.png';
        $csvSrc = besucher_csv_path($dir);
        $csvDst = $dir . DIRECTORY_SEPARATOR . 'besucher-' . $month . '.csv';
        file_put_contents($pngPath, $bin);
        if (is_file($csvSrc)) {
            copy($csvSrc, $csvDst);
        }
        $saved[] = $pngPath;
    }
    return $saved;
}

try {
    $action = $_GET['action'] ?? '';
    $body = $_SERVER['REQUEST_METHOD'] === 'POST' ? besucher_parse_body() : [];
    if ($action === '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $action = (string) ($body['action'] ?? 'append');
    }
    if ($action === '') {
        $action = 'load';
    }

    besucher_pull_public_webfiles();
    $state = besucher_ensure_wipe(besucher_load_state());
    if ($action === 'load' || $action === 'ensure' || $action === 'alias') {
        besucher_publish_http_alias();
    }

    if ($action === 'load' || $action === 'ensure' || $action === 'alias') {
        echo json_encode([
            'ok' => true,
            'action' => $action,
            'demo' => $state['demo'],
            'wiped' => $state['wiped'] ?? false,
            'cutoff' => BESUCHER_CUTOFF,
            'now' => besucher_now()->format('c'),
            'kategorien' => BESUCHER_LABELS,
            'count' => count($state['rows']),
            'rows' => $state['rows'],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'append') {
        $kat = besucher_normalize_kategorie((string) ($body['kategorie'] ?? $body['gruppe'] ?? ''));
        $n = (int) ($body['anzahl'] ?? $body['count'] ?? 0);
        if ($kat === null) {
            $counts = [
                'hinterbliebene' => (int) ($body['hinterbliebene'] ?? $body['grabbesucher'] ?? 0),
                'hausfuehrung' => (int) ($body['hausfuehrung'] ?? 0),
                'grabverkauf' => (int) ($body['grabverkauf'] ?? $body['interessenten'] ?? 0),
            ];
            $positive = [];
            foreach ($counts as $key => $val) {
                if ($val > 0) {
                    $positive[$key] = $val;
                }
            }
            if (count($positive) !== 1) {
                throw new RuntimeException('Genau eine Besuchergruppe mit Anzahl 1–30 angeben.');
            }
            $kat = array_keys($positive)[0];
            $n = $positive[$kat];
        }
        if ($n < 1 || $n > 30) {
            throw new RuntimeException('Anzahl muss zwischen 1 und 30 liegen.');
        }
        $row = besucher_row($kat, $n, besucher_normalize_ts($body['zeitstempel'] ?? null));
        $state['rows'][] = $row;
        besucher_sync_all($state['rows'], $state['demo']);
        echo json_encode([
            'ok' => true,
            'action' => 'append',
            'row' => $row,
            'count' => count($state['rows']),
            'demo' => $state['demo'],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'snapshot') {
        $month = (string) ($body['month'] ?? besucher_now()->format('Y-m'));
        $saved = besucher_save_snapshot($month, (string) ($body['png'] ?? ''));
        echo json_encode([
            'ok' => true,
            'action' => 'snapshot',
            'month' => $month,
            'files' => $saved,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    throw new RuntimeException('Unbekannte action: ' . $action);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
