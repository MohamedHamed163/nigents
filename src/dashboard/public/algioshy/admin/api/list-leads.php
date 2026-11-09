<?php
/**
 * Admin endpoint — list visits & admissions (paginated, filterable).
 */
declare(strict_types=1);
require_once __DIR__ . '/../auth.php';
$me = sc_require_auth();

$type   = $_GET['type']   ?? 'visits'; // visits | admissions
$status = $_GET['status'] ?? '';
$q      = $_GET['q']      ?? '';
$page   = max(1, (int)($_GET['page'] ?? 1));
$per    = min(100, max(5, (int)($_GET['per'] ?? 25)));
$offset = ($page - 1) * $per;

$table = ($type === 'admissions') ? 'admissions' : 'visits';
$pdo = sc_db();

$where = [];
$args = [];
if ($status && $status !== 'all') { $where[] = 'status = ?'; $args[] = $status; }
if ($q) {
    $like = '%' . $q . '%';
    if ($type === 'admissions') {
        $where[] = '(student_name LIKE ? OR parent_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
        $args = array_merge($args, [$like, $like, $like, $like]);
    } else {
        $where[] = '(parent_name LIKE ? OR child_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
        $args = array_merge($args, [$like, $like, $like, $like]);
    }
}
$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// Total count
$cntStmt = $pdo->prepare("SELECT COUNT(*) FROM $table $whereSql");
$cntStmt->execute($args);
$total = (int)$cntStmt->fetchColumn();

// Status counts (all statuses, unfiltered except by type)
$statusCountsStmt = $pdo->query("SELECT status, COUNT(*) AS c FROM $table GROUP BY status");
$statusCounts = [];
foreach ($statusCountsStmt as $row) $statusCounts[$row['status']] = (int)$row['c'];

// Rows
$stmt = $pdo->prepare("SELECT * FROM $table $whereSql ORDER BY created_at DESC LIMIT $per OFFSET $offset");
$stmt->execute($args);
$rows = $stmt->fetchAll();

sc_json_response([
    'type'          => $type,
    'total'         => $total,
    'page'          => $page,
    'per'           => $per,
    'status_counts' => $statusCounts,
    'rows'          => $rows,
]);
