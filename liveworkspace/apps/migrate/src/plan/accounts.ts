// The accounts database (docs/migration.md, step 1): the Clerk users, teams and their members, live API tokens,
// settings, the onboarding emails' stamps and the legacy guests. Every owner, member and token goes through the
// owner map; a row for an account the new side doesn't have (an old id with no Clerk row) is skipped and reported,
// since its foreign key would fail.
import { splitSettings } from '@liveworkspace/settings';
import { RECENT_EXCLUDED_KEY } from './recent-hidden.ts';
import { LIVEDIAGRAM_MEDIA_APP, sha256Hex } from '../ids.ts';
import { DAY_MS, type PlanContext } from './context.ts';

type Row = Record<string, string | number | null>;

// The team_seq bump and read every team and member write takes its rev from (liveworkspace/apps/accounts/src/teams.ts
// BUMP and REV), so the apps' change feed sees each imported row after everything before it.
const BUMP = 'UPDATE team_seq SET value = value + 1 WHERE id = 1';
const REV = { raw: '(SELECT value FROM team_seq WHERE id = 1)' };

const TEAM_NAME_MAX = 80;
const ORGANISATION_MAX = 80;

const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const scalar = (v: unknown): string =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : JSON.stringify(v);
const s = (v: unknown): string | null => (v === null || v === undefined ? null : scalar(v));

export function writeUsers(ctx: PlanContext): void {
  const iso = new Date(ctx.now).toISOString();
  for (const account of ctx.owners.importedAccounts()) {
    const u = account.clerk!;
    ctx.sql.accounts.row({
      table: '"user"',
      key: u.id,
      columns: [
        'id',
        'name',
        'givenName',
        'familyName',
        'email',
        'emailVerified',
        'image',
        'createdAt',
        'updatedAt',
      ],
      values: [
        u.id,
        u.name,
        u.givenName,
        u.familyName,
        u.email,
        u.verified ? 1 : 0,
        null,
        u.createdAt,
        iso,
      ],
      conflict: ['id'],
      version: 'clerk',
    });
  }
  ctx.report.add('accounts.matched', ctx.owners.matches.length);
}

// An old member row's status on the new side: a member with an account is `joined`, an invitation `invited`, a
// declined or expired invitation `declined`. Anything else has no new equivalent.
function memberStatus(
  status: string | null,
  userId: string | null,
): 'joined' | 'invited' | 'declined' | null {
  const st = status ?? (userId ? 'joined' : 'invited');
  if (st === 'joined' || st === 'invited') return st;
  if (st === 'declined' || st === 'expired') return 'declined';
  return null;
}

export function writeTeams(ctx: PlanContext): void {
  const teams = ctx.snapshot.prepare('SELECT * FROM teams ORDER BY id');
  for (const t of teams.iterate() as Iterable<Row>) {
    const name =
      String(t.name ?? '')
        .trim()
        .slice(0, TEAM_NAME_MAX) || 'Team';
    const organisation = s(t.organisation)?.trim().slice(0, ORGANISATION_MAX) || null;
    ctx.sql.accounts.row({
      table: 'team',
      key: String(t.id),
      columns: ['id', 'name', 'organisation', 'createdAt', 'updatedAt', 'deletedAt', 'rev'],
      values: [
        String(t.id),
        name,
        organisation,
        Number(t.created_at),
        Number(t.updated_at),
        null,
        REV,
      ],
      conflict: ['id'],
      version: Number(t.updated_at),
      guard: 'updatedAt',
      update: ['name', 'organisation', 'updatedAt', 'rev'],
      before: BUMP,
    });
    ctx.report.add('teams');
  }
  // Joined rows first, so an invitation for an address a member already holds is the one left out.
  const members = ctx.snapshot.prepare(
    `SELECT * FROM team_members
      ORDER BY team_id, CASE status WHEN 'joined' THEN 0 ELSE 1 END, created_at, id`,
  );
  for (const m of members.iterate() as Iterable<Row>) {
    const id = String(m.id);
    const oldUser = s(m.user_id);
    const userId = oldUser ? ctx.owners.ownerOf(oldUser) : null;
    const account = userId ? ctx.owners.account(userId) : undefined;
    const status = memberStatus(s(m.status), oldUser);
    if (!status) {
      ctx.report.skip('team_member', id, `status ${String(m.status)} has no new equivalent`);
      continue;
    }
    if (status === 'joined' && !account) {
      ctx.report.skip('team_member', id, `joined member ${oldUser ?? '(none)'} has no account`);
      continue;
    }
    // The old creator row may have no email (the old column allowed null): it takes the account's.
    const email = (s(m.email) ?? account?.email ?? '').trim().toLowerCase();
    if (!email) {
      ctx.report.skip('team_member', id, 'no email, and no account to take one from');
      continue;
    }
    if (!m.email && account) ctx.report.add('team_members.emailFromAccount');
    const updatedAt = Number(m.updated_at);
    ctx.sql.accounts.row({
      table: 'team_member',
      key: id,
      columns: [
        'id',
        'teamId',
        'userId',
        'email',
        'role',
        'status',
        'invitedBy',
        'createdAt',
        'updatedAt',
        'rev',
        'declineTokenHashes',
        'clockStartedAt',
        'reminder1SentAt',
        'reminder2SentAt',
        'reminder3SentAt',
        'reminderAttempts',
        'expiredAt',
      ],
      values: [
        id,
        String(m.team_id),
        account ? userId : null,
        email,
        m.role === 'admin' ? 'admin' : 'member',
        status,
        null,
        Number(m.created_at),
        updatedAt,
        REV,
        s(m.decline_token_hashes) ?? '',
        // A pending invitation keeps its reminder clock (docs/migration.md, step 1.4), so the accounts Worker's sweep
        // carries on the old series with the old stamps below and expires it 28 days after it started. An old row
        // from before the clock existed starts it at its invitation.
        status === 'invited' ? (n(m.clock_started_at) ?? Number(m.created_at)) : null,
        n(m.reminder1_sent_at),
        n(m.reminder2_sent_at),
        n(m.reminder3_sent_at),
        Number(m.reminder_attempts ?? 0),
        m.status === 'expired' ? updatedAt : null,
      ],
      conflict: ['id'],
      version: updatedAt,
      guard: 'updatedAt',
      update: ['userId', 'email', 'role', 'status', 'updatedAt', 'rev', 'expiredAt'],
      before: BUMP,
    });
    ctx.report.add(`team_members.${status}`);
  }
}

export function writeTokens(ctx: PlanContext): void {
  const tokens = ctx.snapshot.prepare('SELECT * FROM api_tokens ORDER BY id');
  for (const t of tokens.iterate() as Iterable<Row>) {
    const id = String(t.id);
    const live = Number(t.revoked) === 0 && Number(t.expires_at) > ctx.now;
    const prior = ctx.sql.accounts.prior('api_token', id);
    if (!live) {
      // Copied while live and revoked on the old site since: revoked here too.
      if (prior === JSON.stringify('live') && Number(t.revoked) !== 0) {
        ctx.sql.accounts.raw(
          'api_token',
          `UPDATE api_token SET revokedAt = ${ctx.now} WHERE id = '${id.replaceAll("'", "''")}' AND revokedAt IS NULL`,
          [['api_token', id, JSON.stringify('revoked')]],
        );
        ctx.report.add('tokens.revokedSince');
      } else ctx.report.add(Number(t.revoked) !== 0 ? 'tokens.revoked' : 'tokens.expired');
      continue;
    }
    const userId = ctx.owners.ownerOf(String(t.owner_id));
    if (!ctx.owners.account(userId)) {
      ctx.report.skip('api_token', id, `owner ${String(t.owner_id)} has no account`);
      continue;
    }
    ctx.sql.accounts.row({
      table: 'api_token',
      key: id,
      columns: [
        'id',
        'userId',
        'tokenHash',
        'name',
        'readOnly',
        'createdAt',
        'lastUsedAt',
        'expiresAt',
        'revokedAt',
        'expiryWarnedAt',
        'expiryNotedAt',
      ],
      values: [
        id,
        userId,
        String(t.token_hash),
        s(t.name)?.trim() || 'API token',
        Number(t.read_only ?? 0) ? 1 : 0,
        Number(t.created_at),
        n(t.last_used_at),
        Number(t.expires_at),
        null,
        n(t.expiry_warned_at),
        null,
      ],
      conflict: ['id'],
      version: 'live',
    });
    ctx.report.add('tokens.live');
  }
}

// The old site's renamed and retired preference keys (its packages/api-schema/src/legacy-preferences.ts), applied
// before the blob is split, so an opt-out stored under an old name is never lost.
const RENAMED: Readonly<Record<string, string>> = {
  notifyDiagramJoin: 'notifyDocumentJoin',
  illustrateTourSeen: 'pagesTourSeen',
  illustrateTourKinds: 'pagesTourKinds',
  facilitateTourSeen: 'workshopTourSeen',
};
const RETIRED = new Set([
  'activityPanelEnabled',
  'activityRevertHoverPreview',
  'illustrateModeEnabled',
  'infographicModeEnabled',
  'planModeEnabled',
  'skipLocationStep',
]);
// Preferences that are another app's now (docs/migration.md, step 1.3): Plan's and Forms' tours and form-response
// emails are liveplanner's, the Pages tour is livedocuments' and livedesign's (each takes its own page kinds), and a
// logo page's construction guides are livedesign's. Each app's own user-preferences.ts reads them under these names.
const OTHER_APP_KEYS: Readonly<Record<string, readonly string[]>> = {
  notifyFormResponses: ['liveplanner.app'],
  planTourSeen: ['liveplanner.app'],
  planTourTracks: ['liveplanner.app'],
  formTourSeen: ['liveplanner.app'],
  pagesTourSeen: ['livedocuments.app', 'livedesign.app'],
  pagesTourKinds: ['livedocuments.app', 'livedesign.app'],
  logoGuides: ['livedesign.app'],
  logoGuidesHidden: ['livedesign.app'],
  logoGuideStrength: ['livedesign.app'],
};
// The Pages tour's kinds each app has: an old list is split between them, a kind neither has (photo pages came
// later) dropped.
const PAGE_KINDS_OF: Readonly<Record<string, ReadonlySet<string>>> = {
  'livedocuments.app': new Set(['article', 'slide', 'infographic']),
  'livedesign.app': new Set(['logo', 'wireframe', 'photo']),
};

// A key's value as one app takes it: the Pages tour's kinds cut to that app's own.
function valueFor(site: string, key: string, value: unknown): unknown {
  if (key !== 'pagesTourKinds' || !Array.isArray(value)) return value;
  return value.filter((kind) => PAGE_KINDS_OF[site]!.has(String(kind)));
}

/** The old blob as the new scopes: `all`, livediagram's, and any other app's that took a key. */
export function settingsScopes(
  prefs: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const upgraded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (RETIRED.has(key) || key === RECENT_EXCLUDED_KEY) continue;
    const current = RENAMED[key];
    if (current === undefined) upgraded[key] = value;
    else if (!(current in prefs)) upgraded[current] = value;
  }
  const { all, app } = splitSettings(upgraded);
  const scopes: Record<string, Record<string, unknown>> = { all: {}, [LIVEDIAGRAM_MEDIA_APP]: {} };
  for (const [key, value] of Object.entries(all)) scopes.all![key] = value;
  for (const [key, value] of Object.entries(app)) {
    // splitSettings marks a common key's app copy for deletion (null): a stored blob has nothing to delete.
    if (value === null) continue;
    for (const site of OTHER_APP_KEYS[key] ?? [LIVEDIAGRAM_MEDIA_APP])
      (scopes[site] ??= {})[key] = valueFor(site, key, value);
  }
  return Object.fromEntries(
    Object.entries(scopes).filter(([, blob]) => Object.keys(blob).length > 0),
  );
}

export function writeSettings(ctx: PlanContext): void {
  const rows = ctx.snapshot.prepare(
    'SELECT owner_id, prefs, updated_at FROM user_preferences ORDER BY owner_id',
  );
  for (const r of rows.iterate() as Iterable<Row>) {
    const oldOwner = String(r.owner_id);
    const owner = ctx.owners.ownerOf(oldOwner);
    if (owner.startsWith('user_') && !ctx.owners.account(owner)) {
      ctx.report.skip('settings', oldOwner, 'no account');
      continue;
    }
    let prefs: unknown;
    try {
      prefs = JSON.parse(String(r.prefs));
    } catch {
      prefs = null;
    }
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
      ctx.report.skip('settings', oldOwner, 'unreadable prefs');
      continue;
    }
    const updatedAt = Number(r.updated_at);
    for (const [scope, blob] of Object.entries(settingsScopes(prefs as Record<string, unknown>))) {
      ctx.sql.accounts.row({
        table: 'settings',
        key: `${owner}|${scope}`,
        columns: ['owner_id', 'scope', 'prefs', 'updated_at'],
        values: [owner, scope, JSON.stringify(blob), updatedAt],
        conflict: ['owner_id', 'scope'],
        version: updatedAt,
        guard: 'updated_at',
        update: ['prefs', 'updated_at'],
        // A row the person already has on the new side keeps every value it holds; the old blob only fills the
        // keys it lacks, so an opt-out made on the old site still holds before any email is sent (step 1.3).
        merge: 'prefs = json_patch(excluded.prefs, settings.prefs)',
      });
      ctx.report.add('settings.rows');
    }
  }
}

const STAGES = ['welcome', 'week1', 'week2', 'activation', 'winback'] as const;

export function writeLifecycle(ctx: PlanContext): void {
  const old = ctx.snapshot.prepare('SELECT * FROM email_lifecycle WHERE owner_id = ?');
  const seen = ctx.snapshot.prepare('SELECT first_seen_at FROM auth_accounts WHERE owner_id = ?');
  const active = ctx.snapshot.prepare(
    'SELECT MAX(saved_at) AS at FROM documents WHERE owner_id = ?',
  );
  for (const [clerkId, accountId] of ctx.owners.clerkAccounts()) {
    const row = old.get(clerkId) as Row | undefined;
    const clerk = ctx.owners.account(clerkId)?.clerk ?? ctx.owners.account(accountId)?.clerk;
    const imported = ctx.owners.account(accountId)?.imported ?? false;
    const createdAt = row ? Number(row.created_at) : clerk ? Date.parse(clerk.createdAt) : ctx.now;
    const firstSeen = n((seen.get(clerkId) as Row | undefined)?.first_seen_at) ?? createdAt;
    const appValues = [
      accountId,
      'livediagram.app',
      firstSeen,
      n(row?.milestone_sent_at),
      n(row?.first_share_sent_at),
    ];
    ctx.sql.accounts.row({
      table: 'account_app',
      key: `${accountId}|livediagram.app`,
      columns: ['user_id', 'app', 'first_seen_at', 'milestone_sent_at', 'first_share_sent_at'],
      values: appValues,
      conflict: ['user_id', 'app'],
      version: sha256Hex(JSON.stringify(appValues)),
      merge: [
        'first_seen_at = MIN(account_app.first_seen_at, excluded.first_seen_at)',
        'milestone_sent_at = COALESCE(account_app.milestone_sent_at, excluded.milestone_sent_at)',
        'first_share_sent_at = COALESCE(account_app.first_share_sent_at, excluded.first_share_sent_at)',
      ].join(', '),
    });
    // An account already on the new side with no old row: its own series stands, untouched.
    if (!row && !imported) continue;
    const activeAt = n((active.get(clerkId) as Row | undefined)?.at);
    // The new sweep has no window (accounts/src/lifecycle.ts): a stage still empty is sent as soon as it is due. A
    // stage the old site would already have been due to send by the snapshot counts as sent, so the import sends no
    // one a welcome, a week-two tip or a win-back for an account months old; a stage not yet due stays empty and the
    // series carries on as it would have.
    const due: Record<(typeof STAGES)[number], boolean> = {
      welcome: createdAt <= ctx.now,
      activation: createdAt <= ctx.now - 3 * DAY_MS,
      week1: createdAt <= ctx.now - 7 * DAY_MS,
      week2: createdAt <= ctx.now - 14 * DAY_MS,
      winback: activeAt !== null && activeAt <= ctx.now - 28 * DAY_MS,
    };
    const stamps = STAGES.map(
      (stage) => (row ? n(row[`${stage}_sent_at`]) : null) ?? (due[stage] ? ctx.now : null),
    );
    const values = [
      accountId,
      createdAt,
      ...stamps,
      Number(row?.send_attempts ?? 0),
      n(row?.last_attempt_at),
      activeAt,
      'livediagram.app',
    ];
    ctx.sql.accounts.row({
      table: 'email_lifecycle',
      key: accountId,
      columns: [
        'user_id',
        'created_at',
        ...STAGES.map((st) => `${st}_sent_at`),
        'send_attempts',
        'last_attempt_at',
        'active_at',
        'signup_app',
      ],
      values,
      conflict: ['user_id'],
      version: sha256Hex(JSON.stringify(values)),
      // Over any row: a stage already stamped stays stamped, an empty one takes the old stamp; the newest activity
      // wins. Nothing is ever sent again.
      merge: [
        ...STAGES.map(
          (st) => `${st}_sent_at = COALESCE(email_lifecycle.${st}_sent_at, excluded.${st}_sent_at)`,
        ),
        'active_at = CASE WHEN excluded.active_at IS NULL THEN email_lifecycle.active_at ' +
          'WHEN email_lifecycle.active_at IS NULL THEN excluded.active_at ' +
          'ELSE MAX(email_lifecycle.active_at, excluded.active_at) END',
      ].join(', '),
    });
  }
}

/** One legacy_guest row per migrated guest (docs/migration.md, step 6): written last, once every pass has named
 *  its guests. */
export function writeLegacyGuests(ctx: PlanContext): void {
  const participant = ctx.snapshot.prepare('SELECT created_at FROM participants WHERE id = ?');
  for (const guest of [...ctx.owners.guests].sort()) {
    if (ctx.owners.invalidGuests.has(guest)) {
      ctx.report.skip('legacy_guest', guest, 'not a UUID, so not a valid new guest id');
      continue;
    }
    // The earliest sign of the guest: its participant row, or its first document.
    const seen = [
      n((participant.get(guest) as Row | undefined)?.created_at),
      ctx.guestFirstSeen.get(guest) ?? null,
    ].filter((v): v is number => v !== null);
    const firstSeen = seen.length ? Math.min(...seen) : ctx.now;
    ctx.sql.accounts.row({
      table: 'legacy_guest',
      key: `guest_${guest}`,
      columns: ['id', 'firstSeenAt', 'claimedAt', 'claimedBy'],
      values: [`guest_${guest}`, firstSeen, null, null],
      conflict: ['id'],
      version: firstSeen,
    });
    ctx.report.add('guests');
  }
}

const PROFILE_NAME_MAX = 120;
const PROFILE_COLOR_MAX = 64;

/** Each old participant's name and colour as its owner's new profile (accounts' `profile`), so a guest's cursors
 *  and comments keep the name people knew them by. Insert-only: a profile already on the new side wins. */
export function writeProfiles(ctx: PlanContext): void {
  const rows = ctx.snapshot.prepare(
    'SELECT id, name, color, created_at FROM participants ORDER BY id',
  );
  for (const r of rows.iterate() as Iterable<Row>) {
    const oldId = String(r.id);
    // Only owners the migration carries: an account, or a guest one of its documents, links or events named (not
    // every visitor who ever opened a link).
    if (!oldId.startsWith('user_') && !ctx.owners.guests.has(oldId)) continue;
    const owner = ctx.owners.ownerOf(oldId);
    if (
      owner.startsWith('user_') ? !ctx.owners.account(owner) : ctx.owners.invalidGuests.has(oldId)
    )
      continue;
    const name = (s(r.name) ?? '').trim().slice(0, PROFILE_NAME_MAX) || null;
    const color = (s(r.color) ?? '').trim().slice(0, PROFILE_COLOR_MAX) || null;
    if (!name && !color) continue;
    const at = Number(r.created_at);
    ctx.sql.accounts.row({
      table: 'profile',
      key: owner,
      columns: ['owner_id', 'name', 'color', 'created_at', 'updated_at'],
      values: [owner, name, color, at, at],
      conflict: ['owner_id'],
      version: 1,
    });
    ctx.report.add('profiles');
  }
}
