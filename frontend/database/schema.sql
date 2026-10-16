-- JUJ marketplace schema (MySQL 8 / MariaDB 10.5+). Import in phpMyAdmin, then import seed.sql.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('buyer','seller','admin') NOT NULL DEFAULT 'buyer',
  status ENUM('active','suspended','banned') NOT NULL DEFAULT 'active',
  locale VARCHAR(10) NOT NULL DEFAULT 'en',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  theme ENUM('light','dark','system') NOT NULL DEFAULT 'system',
  email_verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seller_profiles (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  display_name VARCHAR(60) NOT NULL,
  bio TEXT NULL,
  country CHAR(2) NULL,
  verification_status ENUM('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
  rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  sales_count INT NOT NULL DEFAULT 0,
  balance_minor BIGINT NOT NULL DEFAULT 0,
  pending_minor BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_seller_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  parent_id CHAR(36) NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  icon VARCHAR(60) NULL,
  seo_text TEXT NULL,
  commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10,
  sort_order INT NOT NULL DEFAULT 0,
  show_in_header TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_cat_parent (parent_id),
  CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offers (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_id CHAR(36) NOT NULL,
  category_id CHAR(36) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  image_url VARCHAR(500) NULL,
  price_minor INT NOT NULL,
  old_price_minor INT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  delivery_type ENUM('auto_codes','manual') NOT NULL DEFAULT 'auto_codes',
  stock_count INT NOT NULL DEFAULT 0,
  sales_count INT NOT NULL DEFAULT 0,
  status ENUM('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
  region VARCHAR(40) NULL,
  platform VARCHAR(60) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_offer_cat (category_id, status),
  KEY idx_offer_seller (seller_id, status),
  KEY idx_offer_sales (sales_count, id),
  KEY idx_offer_price (price_minor, id),
  CONSTRAINT fk_offer_seller FOREIGN KEY (seller_id) REFERENCES seller_profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_offer_cat FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offer_options (
  id CHAR(36) NOT NULL PRIMARY KEY,
  offer_id BIGINT NOT NULL,
  label VARCHAR(80) NOT NULL,
  price_minor INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_opt_offer (offer_id),
  CONSTRAINT fk_opt_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offer_input_fields (
  id CHAR(36) NOT NULL PRIMARY KEY,
  offer_id BIGINT NOT NULL,
  field_key VARCHAR(40) NOT NULL,
  label VARCHAR(80) NOT NULL,
  type ENUM('text','select','number') NOT NULL,
  select_options TEXT NULL,
  required TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_field (offer_id, field_key),
  CONSTRAINT fk_field_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offer_codes (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT NOT NULL,
  code VARCHAR(500) NOT NULL,
  status ENUM('available','sold') NOT NULL DEFAULT 'available',
  order_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sold_at DATETIME NULL,
  KEY idx_code_offer (offer_id, status),
  CONSTRAINT fk_code_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favorites (
  user_id CHAR(36) NOT NULL,
  offer_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, offer_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_translations (
  entity_type ENUM('offer','category') NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  locale VARCHAR(10) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_type, entity_id, locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  buyer_id CHAR(36) NOT NULL,
  seller_id CHAR(36) NOT NULL,
  offer_id BIGINT NOT NULL,
  option_id CHAR(36) NULL,
  offer_title VARCHAR(160) NOT NULL,
  option_label VARCHAR(80) NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price_minor INT NOT NULL,
  total_minor INT NOT NULL,
  commission_minor INT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  input_values TEXT NULL,
  delivery_type ENUM('auto_codes','manual') NOT NULL,
  status ENUM('pending_payment','paid','delivered','completed','disputed','refunded','cancelled') NOT NULL DEFAULT 'pending_payment',
  payment_provider VARCHAR(20) NOT NULL,
  payment_ref VARCHAR(255) NULL,
  paid_at DATETIME NULL,
  delivered_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_order_buyer (buyer_id, created_at),
  KEY idx_order_seller (seller_id, created_at),
  KEY idx_order_status (status),
  CONSTRAINT fk_order_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
  CONSTRAINT fk_order_seller FOREIGN KEY (seller_id) REFERENCES seller_profiles(user_id),
  CONSTRAINT fk_order_offer FOREIGN KEY (offer_id) REFERENCES offers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_messages (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  sender_id CHAR(36) NULL,
  kind ENUM('message','delivery','system') NOT NULL DEFAULT 'message',
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_msg_order (order_id, id),
  CONSTRAINT fk_msg_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  provider VARCHAR(20) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  amount_minor INT NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'initiated',
  payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tx (provider, external_id),
  KEY idx_tx_order (order_id),
  CONSTRAINT fk_tx_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE,
  buyer_id CHAR(36) NOT NULL,
  seller_id CHAR(36) NOT NULL,
  offer_id BIGINT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT NULL,
  seller_reply TEXT NULL,
  status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_review_seller (seller_id, status, created_at),
  CONSTRAINT fk_review_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payouts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_id CHAR(36) NOT NULL,
  amount_minor INT NOT NULL,
  method VARCHAR(40) NOT NULL,
  details VARCHAR(500) NOT NULL,
  status ENUM('requested','paid','rejected') NOT NULL DEFAULT 'requested',
  admin_note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  KEY idx_payout_seller (seller_id),
  CONSTRAINT fk_payout_seller FOREIGN KEY (seller_id) REFERENCES seller_profiles(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  ip VARCHAR(64) NOT NULL,
  success TINYINT(1) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_la_email (email, created_at),
  KEY idx_la_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type ENUM('verify_email','reset_password') NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(60) NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
