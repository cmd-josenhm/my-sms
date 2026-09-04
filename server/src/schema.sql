-- my-sms — schéma de base de données (idempotent)

CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  avatar_color    TEXT NOT NULL DEFAULT '#0e9f6e',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ,
  auth_token_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username   ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_display    ON users (display_name);
CREATE INDEX IF NOT EXISTS idx_users_token_hash ON users (auth_token_hash)
  WHERE auth_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversations (
  id         BIGSERIAL PRIMARY KEY,
  user_a     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_b     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conv_users_distinct CHECK (user_a <> user_b),
  CONSTRAINT conv_user_order     CHECK (user_a < user_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_pair ON conversations (user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations (user_a);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations (user_b);

CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_read  ON messages (conversation_id, sender_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id         BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  PRIMARY KEY (conversation_id, user_id)
);
