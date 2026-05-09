# ComCoach

A Norwegian-language reading and vocabulary trainer. Paste in any text, double-click words to get in-context definitions and English translations from Gemini, save the session, then review or quiz yourself on words you've learned.

## Stack

- **Client** — React + TypeScript (Vite) at `client/`
- **Server** — Node + Express + TypeScript (tsx) at `server/`
- **Database** — PostgreSQL
- **LLM** — Google Gemini (via the Generative Language API)

---

## Prerequisites

You need these installed locally:

| Tool             | Tested with | Notes                                                                        |
| ---------------- | ----------- | ---------------------------------------------------------------------------- |
| Node.js          | 20+         | Comes with `npm`. The server uses native `fetch`, so 18+ is the minimum.     |
| PostgreSQL       | 14+         | Any version that supports `DISTINCT ON` (basically every modern release).    |
| A Gemini API key | —           | Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |

---

## 1. Clone and install dependencies

```bash
git clone <this-repo-url>
cd ComCoach

# Root dev tooling (concurrently)
npm install

# Client deps
cd client && npm install && cd ..

# Server deps
cd server && npm install && cd ..
```

---

## 2. Set up the database

### Create the database

```bash
# Connect to your local Postgres (adjust user/host as needed)
psql -U postgres

# Inside psql:
CREATE DATABASE comcoach;
\q
```

### Create the schema

Save the SQL below as `schema.sql` (or paste it directly into psql) and apply it to the new database:

```sql
CREATE TABLE sessions (
  id            SERIAL PRIMARY KEY,
  session_theme TEXT,
  text          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_words (
  id             SERIAL PRIMARY KEY,
  session_id     INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  word           TEXT NOT NULL,
  definition_no  TEXT,
  definition_en  TEXT
);

CREATE INDEX idx_session_words_session_id ON session_words(session_id);
CREATE INDEX idx_session_words_word_lower ON session_words(LOWER(word));
```

Apply it:

```bash
psql -U postgres -d comcoach -f schema.sql
```

That's the full schema. Two tables: `sessions` (one row per saved learning session) and `session_words` (one row per word you double-clicked, foreign-keyed to its parent session).

---

## 3. Configure environment variables

Copy the example file at the project root:

```bash
cp .env_EXAMPLE .env
```

Then edit `.env`:

```bash
# Your Gemini API key
GEMINI_API_KEY=your-real-key-here
(or, this could be any api key you want, not necessarily gemini)

# Postgres connection string
# Format: postgres://<user>:<password>@<host>:<port>/<database>
DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/comcoach
```

**Notes:**

- The `.env` lives at the project **root**, not in `server/`. Both `server/src/index.ts` and `server/src/db.ts` resolve it via `path.resolve(__dirname, "../../.env")`.
- URL-encode special characters in your Postgres password (e.g. `@` → `%40`).
- `.env` is gitignored — never commit your real key.

---

## 4. Run the dev servers

From the project root:

```bash
npm run dev
```

This uses `concurrently` to start:

- **Server** on `http://localhost:3001`
- **Client** on `http://localhost:5173` (Vite default)

The Vite dev server proxies `/api/*` to `localhost:3001`, so the client can call `/api/define`, `/api/sessions`, etc. without CORS issues.

You can also run them independently:

```bash
npm run dev:server   # backend only
npm run dev:client   # frontend only
```

### Quick health checks

- Open `http://localhost:3001/api/health` — should return `{"status":"ok","geminiConfigured":true}`. If `geminiConfigured` is `false`, your `.env` isn't being read.
- Open `http://localhost:5173/` — the React app should load. Try double-clicking a word in a Learning Session; if you see a definition, the full pipeline (client → Vite proxy → Express → Gemini → Postgres) is working.

---

## 5. Project layout

```
ComCoach/
├── client/                  # Vite + React frontend
│   ├── src/
│   │   ├── App.tsx          # Routes
│   │   ├── components/
│   │   │   └── Layout.tsx   # Sidebar + content shell
│   │   └── pages/
│   │       ├── Home.tsx
│   │       ├── LearningSession.tsx   # Paste text, double-click words
│   │       ├── Review.tsx            # Past sessions, expandable
│   │       ├── Quiz.tsx              # Three quiz types, AI-graded
│   │       └── WordList.tsx          # All saved words
│   └── vite.config.ts       # Includes /api proxy → localhost:3001
│
├── server/                  # Express backend
│   └── src/
│       ├── index.ts         # All API routes
│       └── db.ts            # Postgres pool
│
├── .env                     # (gitignored) your secrets
├── .env_EXAMPLE             # template
└── package.json             # root scripts (concurrently)
```

---

## 6. API routes (cheat sheet)

| Method | Path                                                    | Purpose                                                   |
| ------ | ------------------------------------------------------- | --------------------------------------------------------- |
| GET    | `/api/health`                                           | Server + Gemini config check                              |
| POST   | `/api/define`                                           | In-context Norwegian definition + 1-word English (Gemini) |
| POST   | `/api/theme`                                            | Generate a theme label for a chunk of text (Gemini)       |
| POST   | `/api/sessions`                                         | Save a session (text + theme + words)                     |
| GET    | `/api/sessions`                                         | List saved sessions (newest first)                        |
| GET    | `/api/sessions/:id`                                     | One session including its words                           |
| GET    | `/api/themes`                                           | Distinct session themes                                   |
| GET    | `/api/words`                                            | All unique saved words                                    |
| GET    | `/api/quiz?type=recent\|random\|theme&theme=X&limit=10` | Word set for a quiz                                       |
| POST   | `/api/quiz/check`                                       | Grade a typed quiz answer (Gemini)                        |

---

## 7. Production build (optional)

```bash
# Build the server (TypeScript → dist/)
cd server && npm run build && cd ..

# Build the client (static assets → client/dist/)
cd client && npm run build && cd ..

# Run the server in production mode
cd server && npm start
```

The client's `client/dist/` output is static — serve it with any web server (nginx, Vercel, Netlify, or Express's `static` middleware). When deploying together, point the static host at `client/dist/` and the API host at the Express server, then update `vite.config.ts` (or your reverse proxy) so `/api/*` targets the deployed server.

---

## Troubleshooting

**`Warning: GEMINI_API_KEY not set`** — `.env` isn't being found, or the key isn't in it. Confirm the file is at the project root (not in `server/`) and that you copied from `.env_EXAMPLE`.

**`Warning: DATABASE_URL not set`** — same as above for the connection string.

**Postgres connection refused** — make sure Postgres is running (`pg_isready` on macOS/Linux; check Services on Windows). Verify the user/password in `DATABASE_URL`.

**Words don't appear in My Word List** — the list reads from `session_words` in Postgres. You need to **save** a Learning Session (not just double-click words) for them to land in the DB.

**Quiz says "Grading unavailable"** — the Gemini call to `/api/quiz/check` failed. Check the server log; likely a key issue or transient overload. The quiz still progresses (answer is counted as missed) so you don't get stuck.
