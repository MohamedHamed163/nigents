<?php
/**
 * Session-based admin authentication.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function sc_session_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $cfg = sc_config();
    session_name('SC_ADMIN');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/admin/',
        'secure'   => !empty($_SERVER['HTTPS']) || ($_SERVER['SERVER_PORT'] ?? '') == '443',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    // Rotate on every request for linked-device safety
    if (!isset($_SESSION['created'])) {
        $_SESSION['created'] = time();
    }
    // Idle timeout
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > ($cfg['session_timeout'] ?? 7200)) {
        sc_logout();
    }
    $_SESSION['last_activity'] = time();
}

function sc_is_authed(): bool {
    sc_session_start();
    return !empty($_SESSION['admin_user_id']);
}

function sc_require_auth(): array {
    sc_session_start();
    if (empty($_SESSION['admin_user_id'])) {
        // For API calls return JSON 401, for pages redirect to login
        if (($_SERVER['HTTP_ACCEPT'] ?? '') === 'application/json' ||
            strpos($_SERVER['REQUEST_URI'] ?? '', '/admin/api/') !== false) {
            sc_json_response(['error' => 'Not authenticated'], 401);
        }
        header('Location: login.php');
        exit;
    }
    return [
        'id'        => (int)$_SESSION['admin_user_id'],
        'username'  => $_SESSION['admin_username'] ?? '',
        'full_name' => $_SESSION['admin_full_name'] ?? '',
        'role'      => $_SESSION['admin_role'] ?? 'viewer',
    ];
}

function sc_login(string $username, string $password): bool {
    $pdo = sc_db();
    $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        return false;
    }
    sc_session_start();
    session_regenerate_id(true);
    $_SESSION['admin_user_id']   = (int)$user['id'];
    $_SESSION['admin_username']  = $user['username'];
    $_SESSION['admin_full_name'] = $user['full_name'];
    $_SESSION['admin_role']      = $user['role'];
    $pdo->prepare('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?')->execute([$user['id']]);
    sc_log_activity((int)$user['id'], 'login', 'admin_users', (int)$user['id']);
    return true;
}

function sc_logout(): void {
    sc_session_start();
    $user = $_SESSION['admin_user_id'] ?? null;
    if ($user) sc_log_activity((int)$user, 'logout', 'admin_users', (int)$user);
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function sc_csrf_token(): string {
    sc_session_start();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function sc_csrf_check(): void {
    sc_session_start();
    $sent = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals($_SESSION['csrf_token'] ?? '', $sent)) {
        sc_json_response(['error' => 'Invalid CSRF token'], 403);
    }
}
