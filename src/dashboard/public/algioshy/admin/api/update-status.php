<?php
/**
 * Admin endpoint — update status or admin_notes for a visit/admission.
 */
declare(strict_types=1);
require_once __DIR__ . '/../auth.php';
$me = sc_require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    sc_json_response(['error' => 'Method not allowed'], 405);
}
sc_csrf_check();

$data = json_decode(file_get_contents('php://input'), true) ?: $_POST;

$type   = $data['type']   ?? '';
$id     = (int)($data['id'] ?? 0);
$status = sc_sanitize($data['status']      ?? '', 40);
$notes  = sc_sanitize($data['admin_notes'] ?? '', 2000);

if (!in_array($type, ['visits', 'admissions'], true) || $id <= 0) {
    sc_json_response(['error' => 'Invalid type or id'], 422);
}

$allowed_visit_status     = ['new','contacted','scheduled','visited','rejected'];
$allowed_admission_status = ['new','reviewing','interview_scheduled','accepted','waitlist','rejected'];
$allowed = $type === 'admissions' ? $allowed_admission_status : $allowed_visit_status;

if ($status && !in_array($status, $allowed, true)) {
    sc_json_response(['error' => 'Invalid status'], 422);
}

$updates = [];
$args = [];
if ($status)          { $updates[] = 'status = ?';      $args[] = $status; }
if ($notes !== null)  { $updates[] = 'admin_notes = ?'; $args[] = $notes; }
if (!$updates) sc_json_response(['error' => 'Nothing to update'], 422);

$args[] = $id;
$sql = "UPDATE $type SET " . implode(', ', $updates) . ' WHERE id = ?';
try {
    $stmt = sc_db()->prepare($sql);
    $stmt->execute($args);
    $affected = $stmt->rowCount();
} catch (Throwable $e) {
    error_log('update failed: ' . $e->getMessage());
    sc_json_response(['error' => 'Update failed'], 500);
}

sc_log_activity($me['id'], 'update', $type, $id,
    ($status ? "status=$status" : '') . ($notes !== null ? ' notes_changed' : ''));

sc_json_response(['ok' => true, 'affected' => $affected]);
