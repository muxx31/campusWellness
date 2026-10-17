# CampusWellness

An anonymous counseling platform: students book 45-minute sessions with counselors, chat in real time during the session window, and counselors receive AI-generated conversation summaries.

## Architecture

```text
                    ┌────────── nginx (web) ──────────┐
 Browser ─────────► │ React SPA   /api → API   /socket.io → API (WebSocket)
                    └───────────────┬─────────────────┘
                                    │ round-robin
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
                API replica 1                 API replica N        (stateless)
              Express + Socket.IO           Express + Socket.IO
                     │   ▲                         │   ▲
                     │   └──── Redis pub/sub ──────┘   │   Socket.IO adapter: rooms work across replicas
                     ▼                                 ▼
        ┌────────────────────────── Redis ──────────────────────────┐
        │ cache · refresh tokens · token blacklist · rate-limit     │
        │ counters · booking locks · live chat buffers · BullMQ     │
        └──────────────────────────┬────────────────────────────────┘
                                   ▼
                          BullMQ worker(s)  ──►  Groq LLM  (summaries)
                                   │
                                   └──────────►  MongoDB   (users, bookings, durable messages)
```

| Concern | How it is solved |
|---|---|
| **Scalability** | API is stateless; all shared state (chat buffers, sessions, locks, rate limits) is in Redis. Run any number of API replicas. |
| **Caching (Redis)** | Counselor list (60 s), per-user booking lists (30 s, invalidated on write), authenticated-user lookups (5 min, invalidated on change). Cache failures never break a request. |
| **Async (BullMQ)** | `chat-persist` queue writes messages to MongoDB (idempotent, 5 retries). `chat-summary` queue generates one debounced AI summary per room (3 retries, exponential backoff, rate-limited to protect the LLM quota) and pushes it to the counselor through the Redis emitter. |
| **Auth** | 15-min JWT access token + single-use rotating refresh token (httpOnly cookie, stored hashed in Redis). Logout revokes both and disconnects live sockets. Roles: `student`, `counselor`, `admin`, enforced by `authorize(...roles)`. |
| **Security** | helmet, strict CORS allow-list, Redis-backed rate limits (global, login, signup, refresh, per-user booking), per-account lockout, Zod validation on every input, NoSQL-injection and HPP sanitizing, 10 kB body limit, bcrypt (12 rounds), constant-time-ish login, per-socket message rate limit, secrets fail-fast validation. |
| **Anonymity** | Students log in with their ID but are known to counselors, in chat and to the AI **only by a random alias** (`Anon-7K2QXM`). The counselor API never returns the student ID, name or user reference. |
| **Strict session window** | Every session is exactly **45 minutes**, enforced by the server (`utils/sessionTime.js`), not the browser: chat can only be opened inside the window, every message is re-checked, and the chat closes itself when time is up. Booking times are wall-clock times in `SESSION_TZ`. |
| **Retention** | Chat content lives **only as long as the session**: the Redis buffer, the AI summary and the MongoDB messages (TTL index on `expireAt`) all expire when the 45 minutes end, and the browser keeps no copy. Booking records (date/time/alias/issue) remain so the dashboards can list past sessions. |
| **Deployment** | Multi-stage Docker images (non-root, healthchecks), `docker-compose.yml` (mongo, redis, 2× API, worker, web), GitHub Actions CI/CD → GHCR → deploy hooks. |

## Run it (free, local)

```bash
cp .env.example .env
# put a 48+ byte random secret in JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
docker compose up --build
```

Open http://localhost:8080. Create the first admin (needed to approve counselors):

```bash
docker compose exec -e ADMIN_EMAIL=you@campus.edu -e ADMIN_PASSWORD='a-long-passphrase' api npm run seed:admin
```

### Without Docker

```bash
# needs MongoDB and Redis running locally
cd server && cp .env.example .env   # fill JWT_SECRET
npm install
npm run dev            # API + Socket.IO  (http://localhost:5001)
npm run dev:worker     # BullMQ worker (or set EMBEDDED_WORKER=true and skip this)

cd ../client
cp .env.example .env && npm install && npm run dev
```

## Admin window

Open **`/admin`** (e.g. http://localhost:8080/admin; deliberately not linked from the public page) and log in with the account you created with `seed:admin`. The console lists counselors with live counts (pending / approved / rejected), search, and **Approve / Reject / Revoke** buttons. Revoking blocks the counselor immediately, ends their refresh tokens and cuts any live chat.

## Counselor approval (RBAC)

With `COUNSELOR_SIGNUP_MODE=approval` (default) a new counselor can sign up but cannot log in until an admin approves them. Existing counselors (no `status` field) are treated as approved. The admin window above does this in the UI; the same thing via the API:

```bash
# 1. log in as admin -> returns { token }
curl -s -X POST localhost:8080/api/admin/login -H 'content-type: application/json' \
  -d '{"email":"you@campus.edu","password":"a-long-passphrase"}'
# 2. list pending
curl -s localhost:8080/api/admin/counselors?status=pending -H "Authorization: Bearer $TOKEN"
# 3. approve
curl -s -X PATCH localhost:8080/api/admin/counselors/<id> -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"status":"approved"}'
```

## API

| Method | Path | Access |
|---|---|---|
| POST | `/api/student/register`, `/api/student/login` | public (rate limited) |
| POST | `/api/counselorAuth/signup`, `/api/counselorAuth/login` | public (rate limited) |
| GET | `/api/counselorAuth/list` | public (cached) |
| POST | `/api/auth/refresh`, `/api/auth/logout` | refresh cookie |
| POST | `/api/book` | student |
| GET | `/api/student/me` | student |
| GET | `/api/bookings/me` | counselor |
| POST | `/api/admin/login` | public (rate limited) |
| GET/PATCH | `/api/admin/counselors[/:id]` | admin |
| GET | `/health` (liveness), `/ready` (Mongo + Redis) | public |

Socket.IO events: `join_room`, `send_message` (client → server); `chat_history`, `session_info` (end time), `receive_message`, `receive_summary`, `session_ended`, `chat_error` (server → client). The room is derived on the server from the verified booking; a client-supplied room id is ignored.

## Configuration

See `server/.env.example`. Required: `MONGO_URI`, `REDIS_URL`, `JWT_SECRET` (≥ 32 chars). The server refuses to start with a missing or weak config.

`SESSION_TZ` (default `Asia/Kolkata`) is the IANA time zone in which booking dates/times are interpreted. Set it to where your students are.

### Upgrading an existing database

If you already have data from the earlier version, run this **once** (it is safe to repeat):

```bash
docker compose exec api npm run migrate:anonymize     # or: cd server && npm run migrate:anonymize
```

It gives every student an anonymous alias, replaces the real student IDs that old bookings exposed to counselors, and deletes old chat messages that were stored without an expiry.

## Tests & CI

```bash
cd server && npm test     # needs MongoDB + Redis (uses Redis db 1 and a *_test database)
```

Tests cover auth, token rotation/revocation, RBAC, counselor approval, booking overlap and a concurrent double-booking race, input validation, NoSQL injection, rate limiting, and the socket chat flow including queue persistence and AI-summary delivery. GitHub Actions (`.github/workflows/ci.yml`) runs them with Mongo and Redis service containers, builds the client, then (on `main`) pushes images to GHCR and triggers optional deploy hooks.

## Deploying on free tiers

* **MongoDB**: Atlas M0.
* **Redis**: Redis Cloud free (30 MB) or any self-hosted Redis. It must use the **`noeviction`** policy for BullMQ. Avoid per-request-priced Redis (e.g. Upstash free): BullMQ polls constantly and exhausts the quota.
* **API**: a Render/Railway/Fly web service from `server/` with `EMBEDDED_WORKER=true` (free tiers rarely offer background workers), `NODE_ENV=production`, `CORS_ORIGINS=<your frontend URL>`, `TRUST_PROXY=1`. With a separately hosted frontend the defaults (`Secure` + `SameSite=None` cookie) are correct.
* **Frontend**: Render static site / Netlify / Vercel with `VITE_BACKEND_URL=<your API URL>`.
* On a paid/VM host, use `docker compose` as-is; scale with `docker compose up -d --scale api=4`.

## Known limits / next steps

* **Planned feature:** an "add 10 minutes" button during a session. The 45-minute length lives in one place (`server/utils/sessionTime.js`); extensions would be added there, and the end time is already pushed to clients (`session_info`) rather than computed by them.
* MongoDB's TTL monitor runs about once a minute, so stored messages can linger up to ~60 s after a session ends. Live chat access is cut exactly at the end by the server.
* AI summaries are deleted with the chat, so counselors cannot read them after the session. Chat/summary content is sent to a third-party LLM (Groq): add a consent screen and consider encryption at rest for real mental-health data.
* The booking form's free-text "issue" is kept with the booking record and can contain identifying details a student chooses to type.
* Refresh-token rotation has no reuse/theft detection (a replayed old token is simply rejected).
* Run `npm install` once in `server/` and `client/` and commit the generated `package-lock.json` files, then enable npm caching in CI.
