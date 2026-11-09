<?php
/**
 * Public endpoint — Admission application form.
 */
declare(strict_types=1);
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

$cfg = sc_config();
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $cfg['allowed_origins'] ?? [], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    sc_json_response(['error' => 'Method not allowed'], 405);
}

sc_rate_limit('admission:' . sc_client_ip(), (int)($cfg['rate_limit_per_hour'] ?? 10));

$raw = file_get_contents('php://input');
$data = [];
if ($raw) {
    $json = json_decode($raw, true);
    if (is_array($json)) $data = $json;
}
if (!$data) $data = $_POST;

$student = sc_sanitize($data['student_name']    ?? '', 120);
$parent  = sc_sanitize($data['parent_name']     ?? '', 120);
$dob     = sc_sanitize($data['date_of_birth']   ?? '', 20);
$grade   = sc_sanitize($data['grade_applying']  ?? '', 20);
$pathway = sc_sanitize($data['pathway']         ?? 'Undecided', 20);
$school  = sc_sanitize($data['current_school']  ?? '', 180);
$phone   = sc_sanitize($data['phone']           ?? '', 40);
$email   = sc_sanitize($data['email']           ?? '', 180);
$address = sc_sanitize($data['address']         ?? '', 500);
$notes   = sc_sanitize($data['notes']           ?? '', 2000);

$errors = [];
if (!$student)                               $errors['student_name'] = 'Student name is required';
if (!$parent)                                $errors['parent_name']  = 'Parent name is required';
if (!$phone)                                 $errors['phone']        = 'Phone number is required';
if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL))
                                             $errors['email']        = 'Invalid email';
if ($dob && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob))
                                             $errors['date_of_birth'] = 'Invalid date (YYYY-MM-DD)';
if (!in_array($pathway, ['IG','American','Undecided'], true)) $pathway = 'Undecided';
if ($errors) sc_json_response(['error' => 'Validation failed', 'fields' => $errors], 422);

if (!empty($data['website']) || !empty($data['url'])) {
    sc_json_response(['ok' => true, 'message' => 'Application received.']);
}

try {
    $stmt = sc_db()->prepare('INSERT INTO admissions
        (student_name, parent_name, date_of_birth, grade_applying, pathway,
         current_school, phone, email, address, notes, ip_address, user_agent)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $student, $parent, $dob ?: null, $grade, $pathway,
        $school, $phone, $email, $address, $notes,
        sc_client_ip(),
        mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
    ]);
    $newId = (int)sc_db()->lastInsertId();
} catch (Throwable $e) {
    error_log('admission insert failed: ' . $e->getMessage());
    sc_json_response(['error' => 'Could not save application. Please try again.'], 500);
}

// Notify admin
$cfg = sc_config();
$to = $cfg['notify_email'] ?? '';
if ($to) {
    $headers = [
        'From: ' . ($cfg['from_name'] ?? 'SC School') . ' <' . ($cfg['from_email'] ?? 'no-reply@smartcollegeschool.com') . '>',
        'Content-Type: text/plain; charset=utf-8',
    ];
    $body = "New admission application received.\n\n" .
            "Student:  $student\n" .
            "DOB:      " . ($dob ?: '—') . "\n" .
            "Grade:    " . ($grade ?: '—') . "\n" .
            "Pathway:  $pathway\n" .
            "Parent:   $parent\n" .
            "Phone:    $phone\n" .
            "Email:    " . ($email ?: '—') . "\n" .
            "School:   " . ($school ?: '—') . "\n" .
            "Address:  " . ($address ?: '—') . "\n" .
            "Notes:\n" . ($notes ?: '—') . "\n\n" .
            "Dashboard: https://smartcollegeschool.com/admin/";
    @mail($to, "[SC School] New Admission Application #$newId", $body, implode("\r\n", $headers));
}

sc_json_response([
    'ok'      => true,
    'id'      => $newId,
    'message' => 'Thank you. Your admission application was received — our team will review it and contact you shortly.',
]);
