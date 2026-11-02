-- Esquema de progresión de Nexo World (MySQL 8 / MariaDB 10.5+).
-- Los tiempos se guardan como milisegundos epoch (BIGINT) para que el
-- desempate por "quién llegó primero" sea exacto e independiente de la zona horaria.

CREATE TABLE IF NOT EXISTS players (
  id CHAR(36) NOT NULL,
  display_name VARCHAR(32) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  -- Reservado para vincular la cuenta de Backend 1 cuando exista.
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
