<?php
/**
 * Smart College School — Admin config
 *
 * 1. Copy this file to: config.php  (DO NOT commit config.php — it's in .gitignore)
 * 2. Fill in your cPanel MySQL credentials.
 * 3. Generate a unique SESSION_SECRET with: openssl rand -hex 32
 */

return [
    // ── MySQL (from cPanel → MySQL Databases) ────────────────────────────
    'db' => [
        'host'     => 'localhost',              // cPanel always uses localhost
        'name'     => 'cpaneluser_scschool',    // DB name (cPanel prefixes your username)
        'user'     => 'cpaneluser_scadmin',     // DB user (cPanel prefixes your username)
        'password' => 'CHANGE_ME_STRONG_PASS',  // DB user password
        'charset'  => 'utf8mb4',
    ],

    // ── Notification email (where new-lead alerts are sent) ──────────────
    'notify_email' => 'admin@smartcollegeschool.com',
    'from_email'   => 'no-reply@smartcollegeschool.com',
    'from_name'    => 'Smart College School',

    // ── Security ─────────────────────────────────────────────────────────
    // Generate with: openssl rand -hex 32
    'session_secret' => 'REPLACE_WITH_RANDOM_64_CHAR_HEX_STRING',

    // CORS origins allowed to POST to /admin/api/submit-*.php
    // Add any staging/preview domains here if you use them.
    'allowed_origins' => [
        'https://smartcollegeschool.com',
        'https://www.smartcollegeschool.com',
        // Testing/staging:
        'https://nigents.com',
        'https://www.nigents.com',
    ],

    // Session inactivity timeout in seconds (default 2 hours)
    'session_timeout' => 7200,

    // Rate limit: max submissions from one IP per hour (for public endpoints)
    'rate_limit_per_hour' => 10,

    // Display timezone for dates in the dashboard
    'timezone' => 'Africa/Cairo',
];
