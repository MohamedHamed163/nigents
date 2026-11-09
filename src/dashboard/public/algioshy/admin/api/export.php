<?php
/**
 * Admin endpoint — export visits/admissions as CSV.
 */
declare(strict_types=1);
require_once __DIR__ . '/../auth.php';
$me = sc_require_auth();

$type   = $_GET['type']   ?? 'visits';
$status = $_GET['status'] ?? '';

$table = ($type === 'admissions') ? 'admissions' : 'visits';

$where = [];
$args  = [];
if ($status && $status !== 'all') { $where[] = 'status = ?'; $args[] = $status; }
$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = sc_db()->prepare("SELECT * FROM $table $whereSql ORDER BY created_at DESC");
$stmt->execute($args);

$filename = $table . '-' . date('Y-m-d') . '.csv';
header('Content-Type: text/csv; charset=utf-8');
header("Content-Disposition: attachment; filename=\"$filename\"");

$out = fopen('php://output', 'w');
fprintf($out, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel
$first = true;
while ($row = $stmt->fetch()) {
    if ($first) { fputcsv($out, array_keys($row)); $first = false; }
    fputcsv($out, $row);
}
fclose($out);
sc_log_activity($me['id'], 'export', $table);
exit;
