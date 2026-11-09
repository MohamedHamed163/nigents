<?php
/**
 * PDO connection helper — shared across all admin endpoints.
 */
declare(strict_types=1);

function sc_config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $path = __DIR__ . '/config.php';
        if (!file_exists($path)) {
            http_response_code(500);
            die('Server misconfigured: admin/config.php is missing. See config.example.php.');
        }
        $cfg = require $path;
    }
    return $cfg;
}

function sc_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $cfg = sc_config()['db'];
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            $cfg['host'], $cfg['name'], $cfg['charset'] ?? 'utf8mb4'
        );
        try {
            $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('DB connect failed: ' . $e->getMessage());
            die('Database connection failed. Check admin/config.php credentials.');
        }
    }
    return $pdo;
}

function sc_json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sc_client_ip(): string {
    $keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'];
    foreach ($keys as $k) {
        if (!empty($_SERVER[$k])) {
            $ip = trim(explode(',', $_SERVER[$k])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return '0.0.0.0';
}

function sc_rate_limit(string $key, int $max_per_hour): void {
    $pdo = sc_db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS rate_limits (
        k VARCHAR(120) PRIMARY KEY,
        hits INT DEFAULT 0,
        window_start INT
    ) ENGINE=InnoDB");
    $now = time();
    $window = $now - ($now % 3600);
    $pdo->prepare('INSERT INTO rate_limits (k, hits, window_start) VALUES (?,1,?)
                   ON DUPLICATE KEY UPDATE
                   hits = IF(window_start = VALUES(window_start), hits + 1, 1),
                   window_start = VALUES(window_start)')
         ->execute([$key, $window]);
    $row = $pdo->prepare('SELECT hits FROM rate_limits WHERE k = ?');
    $row->execute([$key]);
    $hits = (int)($row->fetchColumn() ?: 0);
    if ($hits > $max_per_hour) {
        sc_json_response(['error' => 'Too many requests. Please try again later.'], 429);
    }
}

function sc_sanitize(?string $v, int $max = 500): ?string {
    if ($v === null) return null;
    $v = trim($v);
    if ($v === '') return null;
    // Strip control chars except tab/newline
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
    return mb_substr($v, 0, $max);
}

function sc_log_activity(?int $adminId, string $action, string $targetType, ?int $targetId = null, ?string $details = null): void {
    try {
        $stmt = sc_db()->prepare('INSERT INTO activity_log
            (admin_user_id, action, target_type, target_id, details, ip_address)
            VALUES (?,?,?,?,?,?)');
        $stmt->execute([$adminId, $action, $targetType, $targetId, $details, sc_client_ip()]);
    } catch (Throwable $e) {
        error_log('activity_log failed: ' . $e->getMessage());
    }
}
