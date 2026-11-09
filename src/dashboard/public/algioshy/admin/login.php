<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

$error = null;
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $u = trim((string)($_POST['username'] ?? ''));
    $p = (string)($_POST['password'] ?? '');
    if (sc_login($u, $p)) {
        header('Location: ./');
        exit;
    }
    $error = 'Invalid username or password.';
    // Small delay to slow brute force
    usleep(400000);
}

if (sc_is_authed()) { header('Location: ./'); exit; }
$csrf = sc_csrf_token();
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Login — Smart College</title>
    <link rel="icon" href="../favicon.ico">
    <link rel="stylesheet" href="./assets/admin.css">
</head>
<body class="login-page">
    <div class="login-box">
        <img src="../hero-shield.png" alt="Smart College" class="login-logo">
        <h1>Admin Sign in</h1>
        <p class="muted">Smart College School — Leads Dashboard</p>

        <?php if ($error): ?>
            <div class="alert alert-error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <form method="post" autocomplete="off">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrf) ?>">
            <label>
                <span>Username</span>
                <input type="text" name="username" required autofocus maxlength="60">
            </label>
            <label>
                <span>Password</span>
                <input type="password" name="password" required maxlength="120">
            </label>
            <button type="submit" class="btn-primary">Sign in</button>
        </form>

        <p class="muted small">
            Having trouble? Contact your technical administrator.
        </p>
    </div>
</body>
</html>
