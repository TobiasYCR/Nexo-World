-- Esquema de progresión de Nexo World (MySQL 8 / MariaDB 10.5+).
-- Los tiempos se guardan como milisegundos epoch (BIGINT) para que el
-- desempate por "quién llegó primero" sea exacto e independiente de la zona horaria.

CREATE TABLE IF NOT EXISTS players (
  id CHAR(36) NOT NULL,
  display_name VARCHAR(32) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  -- Cuenta dueña de este jugador (accounts.id), o NULL si es un invitado.
  account_id VARCHAR(64) NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_players_token (token_hash),
  UNIQUE KEY uq_players_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Progreso de un jugador en un mundo y modo. Una sola fila por combinación.
CREATE TABLE IF NOT EXISTS progress (
  player_id CHAR(36) NOT NULL,
  mode VARCHAR(16) NOT NULL,
  world_key VARCHAR(48) NOT NULL,
  revision INT UNSIGNED NOT NULL,
  score INT UNSIGNED NOT NULL,
  stats JSON NOT NULL,
  state JSON NOT NULL,
  updated_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (player_id, mode, world_key),
  CONSTRAINT fk_progress_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mejor marca de cada jugador por modo (como KeepBest de Steam): una fila por jugador.
CREATE TABLE IF NOT EXISTS leaderboard (
  mode VARCHAR(16) NOT NULL,
  player_id CHAR(36) NOT NULL,
  best_score INT UNSIGNED NOT NULL,
  achieved_at BIGINT UNSIGNED NOT NULL,
  world_key VARCHAR(48) NOT NULL,
  PRIMARY KEY (mode, player_id),
  KEY idx_leaderboard_rank (mode, best_score DESC, achieved_at, player_id),
  CONSTRAINT fk_leaderboard_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cuentas de usuario. username_key y email_key son el nombre y el correo en
-- minúsculas: evitan que "Leandro" y "leandro" sean dos cuentas distintas.
-- credential guarda el resultado de PasswordHasher (PBKDF2-SHA-256 con sal).
-- la contraseña nunca se guarda.
CREATE TABLE IF NOT EXISTS accounts (
  id CHAR(36) NOT NULL,
  username VARCHAR(20) NOT NULL,
  username_key VARCHAR(20) NOT NULL,
  email VARCHAR(254) NOT NULL,
  email_key VARCHAR(254) NOT NULL,
  credential JSON NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  updated_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_username (username_key),
  UNIQUE KEY uq_accounts_email (email_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sesiones abiertas. Como con los jugadores, se guarda el hash SHA-256 del
-- token y no el token: una filtración de la tabla no permite entrar a cuentas.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL,
  account_id CHAR(36) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_account (account_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
