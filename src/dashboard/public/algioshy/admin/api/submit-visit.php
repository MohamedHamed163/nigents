<?php
/**
 * Public endpoint — Book a Visit form.
 * Accepts JSON POST from the website.
 */
declare(strict_types=1);
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

// ── CORS ─────────────────────────────────────────────────────────────────
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

// ── Rate limit by IP ─────────────────────────────────────────────────────
sc_rate_limit('visit:' . sc_client_ip(), (int)($cfg['rate_limit_per_hour'] ?? 10));

// ── Parse body (JSON or form) ───────────────────────────────────────────
$raw = file_get_contents('php://input');
$data = [];
if ($raw) {
    $json = json_decode($raw, true);
    if (is_array($json)) $data = $json;
}
if (!$data) $data = $_POST;

$parent  = sc_sanitize($data['parent_name']    ?? '', 120);
$child   = sc_sanitize($data['child_name']     ?? '', 120);
$grade   = sc_sanitize($data['grade']          ?? '', 20);
$school  = sc_sanitize($data['current_school'] ?? '', 180);
$phone   = sc_sanitize($data['phone']          ?? '', 40);
$email   = sc_sanitize($data['email']          ?? '', 180);
$date    = sc_sanitize($data['preferred_date'] ?? '', 20);
$time    = sc_sanitize($data['preferred_time'] ?? '', 20);
$notes   = sc_sanitize($data['notes']          ?? '', 2000);

// ── Validation ───────────────────────────────────────────────────────────
$errors = [];
if (!$parent)                                 $errors['parent_name'] = 'Parent name is required';
if (!$phone)                                  $errors['phone']       = 'Phone number is required';
if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL))
                                              $errors['email']       = 'Invalid email';
if ($date && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date))
                                              $errors['preferred_date'] = 'Invalid date (YYYY-MM-DD)';
if ($errors) sc_json_response(['error' => 'Validation failed', 'fields' => $errors], 422);

// Honeypot (silently accept but ignore)
if (!empty($data['website']) || !empty($data['url'])) {
    sc_json_response(['ok' => true, 'message' => 'Request received. We will contact you shortly.']);
}

// ── Insert ───────────────────────────────────────────────────────────────
try {
    $stmt = sc_db()->prepare('INSERT INTO visits
        (parent_name, child_name, grade, current_school, phone, email,
         preferred_date, preferred_time, notes, ip_address, user_agent)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $parent, $child, $grade, $school, $phone, $email,
        $date ?: null, $time, $notes,
        sc_client_ip(),
        mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
    ]);
    $newId = (int)sc_db()->lastInsertId();
} catch (Throwable $e) {
    error_log('visit insert failed: ' . $e->getMessage());
    sc_json_response(['error' => 'Could not save request. Please try again.'], 500);
}

// ── Notify admin by email ────────────────────────────────────────────────
sc_notify_admin('New Visit Request #' . $newId,
    "A new Book-a-Visit request has been received.\n\n" .
    "Parent:    $parent\n" .
    "Child:     " . ($child ?: '—') . "\n" .
    "Grade:     " . ($grade ?: '—') . "\n" .
    "Phone:     $phone\n" .
    "Email:     " . ($email ?: '—') . "\n" .
    "Preferred: " . ($date ?: '—') . " " . ($time ?: '') . "\n" .
    "School:    " . ($school ?: '—') . "\n" .
    "Notes:\n" . ($notes ?: '—') . "\n\n" .
    "Admin dashboard: (open the admin dashboard on the configured domain)"
);

sc_json_response([
    'ok'      => true,
    'id'      => $newId,
    'message' => 'Thank you. Your visit request was received — we will contact you shortly.',
]);

// ─────────────────────────────────────────────────────────────────────────
function sc_notify_admin(string $subject, string $body): void {
    $cfg = sc_config();
    $to   = $cfg['notify_email'] ?? '';
    if (!$to) return;
    $from = $cfg['from_email'] ?? 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $name = $cfg['from_name']  ?? 'Smart College School';
    $headers = [
        'From: ' . $name . ' <' . $from . '>',
        'Reply-To: ' . $from,
        'X-Mailer: PHP/' . phpversion(),
        'Content-Type: text/plain; charset=utf-8',
    ];
    @mail($to, '[SC School] ' . $subject, $body, implode("\r\n", $headers));
}
