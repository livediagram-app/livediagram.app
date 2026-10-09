# Self-hosting with Docker Compose

Run the whole of livediagram on a machine you control, with no Cloudflare account:
two Node processes — the app and the MCP server — a SQLite file each, a directory of
image bytes, and Caddy in front for TLS. The design lives in [Self-hosted runtime](../specs/016-platform/self-hosted-runtime.md);
this is the practical path.

If you _do_ have a Cloudflare account, [Self-hosting](self-hosting.md) is the
supported path and the one the hosted product runs on. This one exists so "anyone
can self-host" does not mean "on one vendor's platform".

## What you need

Docker with the Compose plugin. Nothing else: no Node, no pnpm, no database server.

## Start it

```bash
cd apps/server
cp .env.example .env
# Required: a secret at least 32 characters long, used to sign sessions and the
# JWTs the api verifies.
openssl rand -base64 32        # paste into BETTER_AUTH_SECRET
docker compose up -d --build
```

Then open <http://localhost:8080>. The stack refuses to start without
`BETTER_AUTH_SECRET` — deliberately, rather than booting with a secret that
changes on every restart and invalidates every session.

To serve a real domain, set in `.env`:

```
SITE_ADDRESS=diagrams.example.com
PUBLIC_ORIGIN=https://diagrams.example.com
HTTPS_PORT=443
```

Caddy obtains the certificate on its own; point the domain's DNS at the machine
first.

## What you get on first boot

The editor, with no sign-in: draw, share a link, keep documents. The canvas has
never required an account, and that is the same here.

The api, the realtime rooms, the identity provider and the five static sites are
all in the one `app` container; [the MCP server](#the-mcp-server) is a second one.
The database is created and the migrations applied on start-up; the log says how
many:

```
[server] applied 78 migrations, up to 0077_workbench.sql
[server] listening on http://0.0.0.0:8787
```

## Accounts

**The browser has no sign-in screen yet** ([Self-hosted runtime blueprint](../specs/016-platform/blueprints/self-hosted-runtime.md),
"Known gaps"). The server side is complete and this is how you use it today — the
front-end is the remaining piece of work.

Sign in, and get a token a script or the CLI can carry:

```bash
BASE=http://localhost:8080

# 1. Ask for a one-time code. Without a mail provider configured, it is printed to
#    the container log rather than emailed.
curl -s -X POST $BASE/api/auth/email-otp/send-verification-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","type":"sign-in"}'
docker compose logs app | grep 'sign-in code'

# 2. Sign in with it. -c keeps the session cookie.
curl -s -c /tmp/livediagram.jar -X POST $BASE/api/auth/sign-in/email-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","otp":"123456"}'

# 3. Mint a JWT for that session.
curl -s -b /tmp/livediagram.jar $BASE/api/auth/token
```

The token is what the api verifies: it carries `sub` (the owner id every document
is keyed by) and `email` (what connects a pending team invitation). Send it as
`Authorization: Bearer …` and documents you create belong to the account rather
than to a browser.

To email the codes instead of logging them, set `RESEND_API_KEY` and `RESEND_FROM`.
To offer Google sign-in as well, set `AUTH_GOOGLE_CLIENT_ID` and
`AUTH_GOOGLE_CLIENT_SECRET`.

## The MCP server

The stack runs a second process: [the MCP server](../specs/015-api/mcp-server.md),
which is how an AI client — Claude, Cursor, the CLI — reads and edits documents. It
answers on **its own origin**, because a client asks for the OAuth discovery
documents at `/.well-known/` on the MCP host, and your app's origin already answers
those paths for itself.

By default it is at <http://mcp.localhost:8080/mcp> — `*.localhost` resolves to this
machine on every desktop OS. To use a real host, which is the only option for a
client on another machine, set it in `.env`:

```
MCP_SITE_ADDRESS=mcp.diagrams.example.com
```

Caddy obtains a certificate for it, as it does for the site address; point the DNS
record at the machine first.

**Connect a client with an API token.** Sign in (above), mint a token in the editor's
Explorer under Account → API tokens, and hand it to the client:

```json
{
  "mcpServers": {
    "livediagram": {
      "type": "http",
      "url": "http://mcp.localhost:8080/mcp",
      "headers": { "Authorization": "Bearer lvd_…" }
    }
  }
}
```

Measured against this stack: `initialize`, `tools/list` (24 tools) and
`create_document` — which writes the document and returns a PNG of the tab.

**The OAuth flow is served, but its last step is not wired for self-hosting yet.**
The MCP process is a complete OAuth 2.1 authorization server — discovery, dynamic
client registration, PKCE — and the consent page is the editor's `/oauth/consent`.
What is missing is that the consent page posts the minted token to a **build-time**
MCP origin, the hosted `https://mcp.livediagram.app` unless the sites were built
with `NEXT_PUBLIC_MCP_ORIGIN`, so a self-hosted deployment would hand it to the
wrong server. Until that is resolved ([blueprint](../specs/016-platform/blueprints/self-hosted-runtime.md),
"Known gaps"), connect clients with an API token.

The MCP keeps its own database file. It holds OAuth client registrations, authorize
sessions and codes — scratch state with short TTLs — and it sits beside the app's
file rather than inside it so that one process writes each.

## Your data

Everything an operator owns is under `apps/server/data`:

| Path                          | What                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| `data/livediagram.sqlite`     | Documents, tabs, comments, teams, images' metadata — and the account tables |
| `data/livediagram.sqlite-wal` | Write-ahead log; part of the database, not a copy of it                     |
| `data/mcp.sqlite`             | The MCP server's OAuth scratch state; losing it costs a re-registration     |
| `data/objects/`               | Image bytes and document snapshots                                          |

**Back this directory up.** Stop the container for a plain copy, or copy the
database safely while it runs:

```bash
docker compose exec app node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('/data/livediagram.sqlite');
  db.exec(\"VACUUM INTO '/data/backup.sqlite'\");
"
```

Then move `data/backup.sqlite` (and `data/objects`) somewhere else. A backup on the
same disk is a backup of the disk failing, not of losing your work.

**Restore** is the same in reverse: stop the stack, replace
`data/livediagram.sqlite` with the snapshot, start it. The migrations table travels
with the file, so a snapshot from an older version is migrated forward on the next
boot.

## Upgrading

```bash
git pull
cd apps/server
docker compose build && docker compose up -d
```

Migrations are applied at start-up, in order, each in its own transaction — a
migration that fails leaves the database at the last one that fully applied and the
process refuses to serve. The migrations table is wrangler's own `d1_migrations`, so
a database can move between this runtime and a Cloudflare deployment.

Take a snapshot before upgrading (above). There is no down-migration.

## Changing `BETTER_AUTH_SECRET`

The secret encrypts the signing keys in the database. Change it without clearing them
and every session and every token breaks — the log says so, once per request:

```
ERROR [Better Auth]: Failed to decrypt private key. Make sure the secret currently in
use is the same as the one used to encrypt the private key.
```

Sign-in still returns 200 (the session row is written), so it looks like the cookie is
the problem. It is not. Clear the stale keys and restart:

```bash
docker compose exec app node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('/data/livediagram.sqlite');
  db.exec('DELETE FROM jwks');
"
docker compose restart app
```

The next start generates a fresh key pair under the new secret. Everybody signs in
again; their documents are untouched, because ownership is the account id, not the key.

**Pick the secret once and keep it.** A secret that changes on every restart — the
warning the app prints when `BETTER_AUTH_SECRET` is unset — does the same thing to
every session, quietly.

## Troubleshooting

| Symptom                                                                   | Cause                                                                                                                                                                              |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `required variable BETTER_AUTH_SECRET is missing a value`                 | Set it in `.env` (see above). The stack will not start without it.                                                                                                                 |
| `[auth] BETTER_AUTH_SECRET is unset: sessions will not survive a restart` | Running the image without Compose. The stack works; every restart signs everyone out.                                                                                              |
| The editor loads but saving fails                                         | The api is not reachable at the origin the browser uses. Check `PUBLIC_ORIGIN` matches the URL in the address bar.                                                                 |
| Sign-in says the code is wrong                                            | The code expires. Ask for a new one; the log shows only the newest.                                                                                                                |
| Rooms work for one person, not two                                        | Known: [relaying between two clients](../specs/016-platform/blueprints/self-hosted-runtime.md#known-defect-relaying-between-two-clients).                                          |
| Caddy cannot get a certificate                                            | The domain must already resolve to this machine, and ports 80 and 443 must reach it.                                                                                               |
| An MCP client cannot connect                                              | Use the MCP origin, not the site's: `http://mcp.localhost:8080/mcp` with an `Authorization: Bearer lvd_…` header. The OAuth flow's consent step is not wired for self-hosting yet. |
