<?php
/**
 * Aufrufzählung für dienste.html.
 * POST { programmteil } → Zeile in Historie/Dienste/aufrufe.csv
 * Spalten: Timestamp;Programmteil;IP-Adresse
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

const ZAEHLUNG_TZ = 'Europe/Berlin';
const ZAEHLUNG_TEILE = [
    'Gesamtprogramm',
    'Unterprogramm Geburts- und Sterbetage',
    'Unterprogramm Eintrag Besuchergruppe',
];

function zaehlung_now(): DateTimeImmutable
{
    return new DateTimeImmutable('now', new DateTimeZone(ZAEHLUNG_TZ));
}

function zaehlung_dirs(): array
{
    $dirs = [__DIR__ . DIRECTORY_SEPARATOR . 'Historie' . DIRECTORY_SEPARATOR . 'Dienste'];
    $public = '/volume1/public/Grabbuch/Historie/Dienste';
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

function zaehlung_csv_path(string $dir): string
{
    return $dir . DIRECTORY_SEPARATOR . 'aufrufe.csv';
}

function zaehlung_header(): string
{
    return "\xEF\xBB\xBF" . "Timestamp;Programmteil;IP-Adresse\n";
}

function zaehlung_client_ip(): string
{
    $candidates = [];
    $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($xff !== '') {
        foreach (explode(',', $xff) as $part) {
            $candidates[] = trim($part);
        }
    }
    foreach (['HTTP_CLIENT_IP', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            $candidates[] = trim((string) $_SERVER[$key]);
        }
    }
    foreach ($candidates as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return '';
}

function zaehlung_parse_body(): array
{
    $raw = file_get_contents('php://input');
    $json = json_decode($raw ?: '[]', true);
    if (!is_array($json)) {
        $json = [];
    }
    return array_merge($_POST, $json);
}

function zaehlung_ensure_file(string $path): void
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    if (!is_file($path) || filesize($path) === 0) {
        file_put_contents($path, zaehlung_header(), LOCK_EX);
    }
}

function zaehlung_append_line(string $teil, string $ip, string $ts): array
{
    $line = $ts . ';' .
        str_replace([';', "\r", "\n"], [',', '', ''], $teil) . ';' .
        str_replace([';', "\r", "\n"], [',', '', ''], $ip) . "\n";
    $written = [];
    foreach (zaehlung_dirs() as $dir) {
        $path = zaehlung_csv_path($dir);
        zaehlung_ensure_file($path);
        $fh = fopen($path, 'ab');
        if ($fh === false) {
            continue;
        }
        flock($fh, LOCK_EX);
        fwrite($fh, $line);
        flock($fh, LOCK_UN);
        fclose($fh);
        $written[] = $path;
    }
    if (!$written) {
        throw new RuntimeException('Aufrufdatei nicht schreibbar.');
    }
    return $written;
}

function zaehlung_read_rows(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') {
        return [];
    }
    $raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
    $lines = preg_split("/\r\n|\n|\r/", $raw);
    $rows = [];
    foreach ($lines as $line) {
        $trim = trim($line);
        if ($trim === '' || strpos($trim, '#') === 0) {
            continue;
        }
        $parts = explode(';', $line);
        $first = strtolower(trim((string) ($parts[0] ?? '')));
        $first = preg_replace('/^\xef\xbb\xbf/', '', $first);
        if ($first === 'timestamp' || $first === '') {
            continue;
        }
        $teil = trim((string) ($parts[1] ?? ''));
        if (!in_array($teil, ZAEHLUNG_TEILE, true)) {
            continue;
        }
        $rows[] = [
            'timestamp' => trim((string) $parts[0]),
            'programmteil' => $teil,
            'ip' => trim((string) ($parts[2] ?? '')),
        ];
    }
    return $rows;
}

function zaehlung_read_count(string $path): int
{
    return count(zaehlung_read_rows($path));
}

try {
    $body = $_SERVER['REQUEST_METHOD'] === 'POST' ? zaehlung_parse_body() : [];
    $action = $_GET['action'] ?? (string) ($body['action'] ?? '');
    if ($action === '') {
        $action = $_SERVER['REQUEST_METHOD'] === 'POST' ? 'append' : 'load';
    }

    if ($action === 'load') {
        $primary = zaehlung_csv_path(zaehlung_dirs()[0]);
        $rows = zaehlung_read_rows($primary);
        echo json_encode([
            'ok' => true,
            'action' => 'load',
            'count' => count($rows),
            'teile' => ZAEHLUNG_TEILE,
            'rows' => $rows,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'append') {
        $teil = trim((string) ($body['programmteil'] ?? $body['teil'] ?? ''));
        if (!in_array($teil, ZAEHLUNG_TEILE, true)) {
            throw new RuntimeException('Unbekannter Programmteil.');
        }
        $ts = zaehlung_now()->format('Y-m-d H:i:s');
        $ip = zaehlung_client_ip();
        zaehlung_append_line($teil, $ip, $ts);
        echo json_encode([
            'ok' => true,
            'action' => 'append',
            'timestamp' => $ts,
            'programmteil' => $teil,
            'ip' => $ip,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    throw new RuntimeException('Unbekannte action: ' . $action);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
