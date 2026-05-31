-- ComCoach database schema
-- Run against any Postgres database to create all tables:
--   psql -d comcoach -f schema.sql
--   psql -d comcoach_test -f schema.sql

CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  session_theme TEXT,
  text          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_words (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  word          TEXT NOT NULL,
  definition_no TEXT NOT NULL,
  definition_en TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_words_session_id
  ON session_words(session_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id         SERIAL PRIMARY KEY,
  quiz_type  TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  theme      TEXT,
  total      INTEGER NOT NULL,
  correct    INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS essay_attempts (
  id              SERIAL PRIMARY KEY,
  target_level    TEXT NOT NULL,
  achieved_level  TEXT NOT NULL,
  topic           TEXT NOT NULL,
  essay_text      TEXT NOT NULL,
  corrected_text  TEXT NOT NULL,
  feedback        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           JSONB,
  next_level_text TEXT
);
