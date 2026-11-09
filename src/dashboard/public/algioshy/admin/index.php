<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$me = sc_require_auth();
$csrf = sc_csrf_token();
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Dashboard — Smart College</title>
    <link rel="icon" href="../favicon.ico">
    <link rel="stylesheet" href="./assets/admin.css">
    <script>
        window.SC_CSRF = <?= json_encode($csrf) ?>;
        window.SC_ME = <?= json_encode($me) ?>;
    </script>
</head>
<body>
    <header class="topbar">
        <div class="brand">
            <img src="../hero-shield.png" alt="SC">
            <div>
                <div class="brand-title">Smart College</div>
                <div class="brand-sub">Admin Dashboard</div>
            </div>
        </div>
        <div class="user-meta">
            <span><?= htmlspecialchars($me['full_name'] ?: $me['username']) ?></span>
            <span class="badge badge-role"><?= htmlspecialchars($me['role']) ?></span>
            <a href="./logout.php" class="btn-ghost">Sign out</a>
        </div>
    </header>

    <nav class="tabs">
        <button class="tab active" data-type="visits">Visit Requests</button>
        <button class="tab" data-type="admissions">Admission Applications</button>
    </nav>

    <section class="toolbar">
        <div class="status-chips" id="statusChips"></div>
        <div class="tools">
            <input type="text" id="searchBox" placeholder="Search name, phone, email…">
            <a class="btn-ghost" id="exportBtn" href="#">Export CSV</a>
        </div>
    </section>

    <main>
        <div id="empty" class="empty hidden">
            <p>No records match your filter.</p>
        </div>
        <table id="leads-table" class="leads-table">
            <thead></thead>
            <tbody></tbody>
        </table>
        <div id="pagination" class="pagination"></div>
    </main>

    <!-- Detail drawer -->
    <aside id="drawer" class="drawer hidden">
        <div class="drawer-overlay" data-close></div>
        <div class="drawer-panel">
            <button class="drawer-close" data-close aria-label="Close">&times;</button>
            <div id="drawerContent"></div>
        </div>
    </aside>

    <script src="./assets/admin.js"></script>
</body>
</html>
