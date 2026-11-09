-- ═══════════════════════════════════════════════════════════════════════
--  Smart College School — Admin DB schema
--  Run this ONCE in cPanel → phpMyAdmin → SQL tab
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS visits (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  parent_name       VARCHAR(120) NOT NULL,
  child_name        VARCHAR(120),
  grade             VARCHAR(20),
  current_school    VARCHAR(180),
  phone             VARCHAR(40) NOT NULL,
  email             VARCHAR(180),
  preferred_date    DATE,
  preferred_time    VARCHAR(20),
  notes             TEXT,
  status            ENUM('new','contacted','scheduled','visited','rejected') DEFAULT 'new',
  source            VARCHAR(40) DEFAULT 'website',
  ip_address        VARCHAR(45),
  user_agent        VARCHAR(255),
  admin_notes       TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admissions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  student_name      VARCHAR(120) NOT NULL,
  parent_name       VARCHAR(120) NOT NULL,
  date_of_birth     DATE,
  grade_applying    VARCHAR(20),
  pathway           ENUM('IG','American','Undecided') DEFAULT 'Undecided',
  current_school    VARCHAR(180),
  phone             VARCHAR(40) NOT NULL,
  email             VARCHAR(180),
  address           TEXT,
  notes             TEXT,
  status            ENUM('new','reviewing','interview_scheduled','accepted','waitlist','rejected') DEFAULT 'new',
  ip_address        VARCHAR(45),
  user_agent        VARCHAR(255),
  admin_notes       TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  username          VARCHAR(60) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  full_name         VARCHAR(120),
  email             VARCHAR(180),
  role              ENUM('admin','viewer') DEFAULT 'viewer',
  last_login_at     TIMESTAMP NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_log (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  admin_user_id     INT,
  action            VARCHAR(80),
  target_type       VARCHAR(40),
  target_id         INT,
  details           TEXT,
  ip_address        VARCHAR(45),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (admin_user_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
