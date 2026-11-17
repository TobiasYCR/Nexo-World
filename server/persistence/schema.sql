-- Esquema de Nexo World (PostgreSQL 13+). Se aplica solo al iniciar el
-- servidor: todo es IF NOT EXISTS, así se puede correr las veces que haga falta.
-- Los tiempos se guardan como milisegundos epoch (BIGINT) para que el
-- desempate por "quién llegó primero" sea exacto e independiente de la zona horaria.

CREATE TABLE IF NOT EXISTS players (
  id VARCHAR(36) PRIMARY KEY,
  display_name VARCHAR(32) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  -- Cuenta dueña de este jugador (accounts.id), o NULL si es un invitado.
  account_id VARCHAR(64) NULL,
  created_at BIGINT NOT NULL CHECK (created_at >= 0),
  CONSTRAINT uq_players_token UNIQUE (token_hash),
  CONSTRAINT uq_players_account UNIQUE (account_id)
);

-- Progreso de un jugador en un mundo y modo. Una sola fila por combinación.
CREATE TABLE IF NOT EXISTS progress (
  player_id VARCHAR(36) NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  mode VARCHAR(16) NOT NULL,
  world_key VARCHAR(48) NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  score INTEGER NOT NULL CHECK (score >= 0),
  stats JSONB NOT NULL,
  state JSONB NOT NULL,
  updated_at BIGINT NOT NULL CHECK (updated_at >= 0),
  PRIMARY KEY (player_id, mode, world_key)
);

-- Mejor marca de cada jugador por modo (como KeepBest de Steam): una fila por jugador.
CREATE TABLE IF NOT EXISTS leaderboard (
  mode VARCHAR(16) NOT NULL,
  player_id VARCHAR(36) NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  best_score INTEGER NOT NULL CHECK (best_score >= 0),
  achieved_at BIGINT NOT NULL CHECK (achieved_at >= 0),
  world_key VARCHAR(48) NOT NULL,
  PRIMARY KEY (mode, player_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard (mode, best_score DESC, achieved_at, player_id);

-- Cuentas de usuario. username_key y email_key son el nombre y el correo en
-- minúsculas: evitan que "Leandro" y "leandro" sean dos cuentas distintas.
-- credential guarda el resultado de PasswordHasher (PBKDF2-SHA-256 con sal);
-- la contraseña nunca se guarda.
CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(20) NOT NULL,
  username_key VARCHAR(20) NOT NULL,
  email VARCHAR(254) NOT NULL,
  email_key VARCHAR(254) NOT NULL,
  credential JSONB NOT NULL,
  created_at BIGINT NOT NULL CHECK (created_at >= 0),
  updated_at BIGINT NOT NULL CHECK (updated_at >= 0),
  CONSTRAINT uq_accounts_username UNIQUE (username_key),
  CONSTRAINT uq_accounts_email UNIQUE (email_key)
);

-- Formato de nombre y correo también en la base, por si algo escribe sin pasar
-- por UserValidator. NOT VALID: rige para filas nuevas y modificadas, sin
-- revisar las que ya existían (así agregarla nunca frena el arranque).
DO $$
BEGIN
  ALTER TABLE accounts ADD CONSTRAINT ck_accounts_username
    CHECK (username_key ~ '^[a-z0-9][a-z0-9_-]{2,19}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE accounts ADD CONSTRAINT ck_accounts_email
    CHECK (email_key ~ '^[a-z0-9_%+-]([a-z0-9._%+-]*[a-z0-9_%+-])?@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}$'
      AND position('..' in email_key) = 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sesiones abiertas. Como con los jugadores, se guarda el hash SHA-256 del
-- token y no el token: una filtración de la tabla no permite entrar a cuentas.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL CHECK (created_at >= 0),
  expires_at BIGINT NOT NULL CHECK (expires_at >= 0)
);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions (account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

-- Códigos de recuperación de contraseña. Los genera un administrador con
-- npm run admin (no hay servidor de correo). Se guarda el hash del código, que
-- vence pronto y sirve una sola vez.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL CHECK (created_at >= 0),
  expires_at BIGINT NOT NULL CHECK (expires_at >= 0),
  used_at BIGINT NULL CHECK (used_at >= 0)
);
CREATE INDEX IF NOT EXISTS idx_password_resets_account ON password_resets (account_id);
