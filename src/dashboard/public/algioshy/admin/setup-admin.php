<?php
/**
 * First-admin bootstrapper.
 *
 * USE ONCE to create the initial admin account, then DELETE this file.
 *
 * Usage:
 *   1. Upload admin/ folder to public_html/admin/
 *   2. Create admin/config.php from config.example.php (fill DB creds)
 *   3. Run schema.sql in phpMyAdmin
 *   4. Visit:   https://smartcollegeschool.comsetup-admin.php
 *      Enter the username + password you want for the first admin.
 *   5. DELETE setup-admin.php after you log in successfully.
 *      (The script refuses to run if an admin already exists.)
 */
declare(strict_types=1);
require_once __DIR__ . '/db.php';

$pdo = sc_db();
$pdo->exec("SET SESSION sql_mode=''"); // permissive

// Ensure schema exists
$tables = $pdo->query("SHOW TABLES LIKE 'admin_users'")->fetchColumn();
if (!$tables) {
    die('<h2>Schema missing</h2><p>Please run <code>admin/schema.sql</code> in phpMyAdmin first, then reload this page.</p>');
}

// Refuse to run if any admin user already exists
$count = (int)$pdo->query("SELECT COUNT(*) FROM admin_users")->fetchColumn();
if ($count > 0) {
    die('<h2>Already set up</h2><p>An admin user already exists. <strong>Delete this file now</strong> — <code>setup-admin.php</code> — for security.</p><p><a href="./login.php">Go to login</a></p>');
}

$err = null;
$done = false;
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $u  = trim((string)($_POST['username'] ?? ''));
    $p  = (string)($_POST['password'] ?? '');
    $p2 = (string)($_POST['password_confirm'] ?? '');
    $fn = trim((string)($_POST['full_name'] ?? ''));
    $em = trim((string)($_POST['email'] ?? ''));

    if (!preg_match('/^[a-zA-Z0-9_.-]{3,60}$/', $u)) {
        $err = 'Username must be 3–60 chars (letters, numbers, _ . -)';
    } elseif (strlen($p) < 10) {
        $err = 'Password must be at least 10 characters.';
    } elseif ($p !== $p2) {
        $err = 'Passwords do not match.';
    } else {
        try {
            $hash = password_hash($p, PASSWORD_BCRYPT, ['cost' => 12]);
            $stmt = $pdo->prepare('INSERT INTO admin_users (username, password_hash, full_name, email, role) VALUES (?,?,?,?,?)');
            $stmt->execute([$u, $hash, $fn ?: null, $em ?: null, 'admin']);
            $done = true;
        } catch (Throwable $e) {
            $err = 'Failed: ' . htmlspecialchars($e->getMessage());
        }
    }
}
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Setup — Smart College</title>
    <link rel="stylesheet" href="./assets/admin.css">
</head>
<body class="login-page">
    <div class="login-box">
        <h1>Create first admin</h1>
        <p class="muted">This page works only once. Delete it after you log in.</p>

        <?php if ($done): ?>
            <div class="alert" style="background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7">
                <strong>Admin created!</strong> Now do these two things:
                <ol style="margin-top:8px;padding-left:20px;font-size:13px;">
                    <li><strong>Delete</strong> <code>setup-admin.php</code> from cPanel File Manager.</li>
                    <li>Sign in at <a href="./login.php">the login page</a>.</li>
                </ol>
            </div>
        <?php else: ?>
            <?php if ($err): ?><div class="alert alert-error"><?= htmlspecialchars($err) ?></div><?php endif; ?>
            <form method="post" autocomplete="off">
                <label><span>Username</span>
                    <input name="username" required maxlength="60" pattern="[a-zA-Z0-9_.\-]{3,60}"></label>
                <label><span>Full name</span>
                    <input name="full_name" maxlength="120"></label>
                <label><span>Email (optional)</span>
                    <input type="email" name="email" maxlength="180"></label>
                <label><span>Password (min 10 chars)</span>
                    <input type="password" name="password" required minlength="10"></label>
                <label><span>Confirm password</span>
                    <input type="password" name="password_confirm" required minlength="10"></label>
                <button type="submit" class="btn-primary">Create admin</button>
            </form>
        <?php endif; ?>
    </div>
</body>
</html>
