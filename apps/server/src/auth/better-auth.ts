import { betterAuth, type Auth, type BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { emailOTP, genericOAuth, jwt } from 'better-auth/plugins';
import type { DatabaseSync } from 'node:sqlite';

// The self-hosted identity provider: Better Auth, inside the app process
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Identity: Better Auth
// in the app process").
//
// What the application needs from an identity provider is narrow, and this is the
// whole of it: a JWKS the api can verify against, JWTs carrying `sub` (the owner
// id every document is keyed by) and `email` (the only email the worker trusts,
// used to connect pending team invites). Everything else — teams, API tokens,
// sharing, the MCP's own OAuth server — is application code that never learns
// which provider signed the token.
//
// The database is the same \`node:sqlite\` handle the documents live in: one file,
// one backup, as the blueprint's Q2 settled.

export type SendOtp = (input: { email: string; otp: string; type: string }) => Promise<void>;

export type AuthOptions = {
  /** The raw handle, not the seam's Db: Better Auth owns its own tables. */
  sql: DatabaseSync;
  /** The deployment's public origin, e.g. https://diagrams.example.com. */
  baseUrl: string;
  /** At least 32 characters; the operator generates it (openssl rand -base64 32). */
  secret: string;
  /** How a one-time code reaches a person. Console by default. */
  sendOtp?: SendOtp;
  /** Extra origins allowed to call the auth endpoints, comma separated. */
  trustedOrigins?: string;
  /** Optional: a Feishu (Lark) app, off until an operator sets one. */
  feishu?: { clientId: string; clientSecret: string };
  /** Optional: a Google OAuth client, off until an operator sets one. */
  google?: { clientId: string; clientSecret: string };
};

/**
 * A code that reaches nobody is useless, so the default prints it: a self-host
 * with no mail provider yet can still sign in and read the code off its own logs.
 */
const consoleOtp: SendOtp = async ({ email, otp, type }) => {
  console.log(`[auth] ${type} code for ${email}: ${otp}`);
};

/**
 * The origins allowed to call the auth endpoints: this deployment's own address, the
 * same server reached as localhost or 127.0.0.1, and anything the operator names.
 */
function trustedOrigins(options: AuthOptions): string[] {
  const origins = new Set<string>([options.baseUrl.replace(/\/$/, '')]);
  for (const extra of (options.trustedOrigins ?? '').split(',')) {
    const trimmed = extra.trim();
    if (trimmed) origins.add(trimmed.replace(/\/$/, ''));
  }
  try {
    const { port } = new URL(options.baseUrl);
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      origins.add(`http://${host}${port ? `:${port}` : ''}`);
    }
  } catch {
    // A baseUrl that is not a URL is Better Auth's problem to report, not ours.
  }
  return [...origins];
}

/** The options the instance AND the schema generator read, from one place. */
export function authOptions(options: AuthOptions): BetterAuthOptions {
  return {
    database: options.sql,
    baseURL: options.baseUrl,
    secret: options.secret,
    // Which origins may POST to the auth endpoints. Better Auth refuses anything else
    // with "Invalid origin" (measured: a browser on http://127.0.0.1:8099 was rejected
    // because PUBLIC_ORIGIN said http://localhost:8099 — same server, different name),
    // and every self-host hits this the first time it is opened on an address that is
    // not the one in .env. The base URL is the deployment's own name for itself; the
    // loopback pair covers the same server reached by either spelling; AUTH_TRUSTED_ORIGINS
    // adds whatever else an operator fronts it with.
    trustedOrigins: trustedOrigins(options),
    // Sign-in is a one-time code or Google, never a password: nothing to leak,
    // nothing to reset.
    emailAndPassword: { enabled: false },
    plugins: [
      emailOTP({
        sendVerificationOTP: async ({
          email,
          otp,
          type,
        }: {
          email: string;
          otp: string;
          type: string;
        }) => {
          await (options.sendOtp ?? consoleOtp)({ email, otp, type });
        },
      }),
      // The JWKS the api verifies against, and the /token endpoint that mints a
      // verifiable JWT for a signed-in session. The api never sees a session
      // cookie: it speaks bearer tokens, exactly as it does against Clerk.
      jwt({
        jwt: {
          definePayload: ({ user }: { user: { id: string; email: string } }) => ({
            sub: user.id,
            email: user.email,
          }),
        },
      }),
      // Feishu (Lark), through the generic OAuth plugin: Better Auth has no built-in
      // provider for it, and the differences are all things this plugin exposes hooks
      // for — see feishuProvider below.
      genericOAuth({ config: options.feishu ? [feishuProvider(options.feishu)] : [] }),
    ],
    ...(options.google ? { socialProviders: { google: options.google } } : {}),
  };
}

/**
 * Feishu's OAuth, wired for the generic plugin
 * (https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token).
 *
 * Three things differ from a textbook provider, and each is why this is a function
 * rather than three URLs:
 *
 * 1. `user_info` answers `{ code, msg, data: {...} }`, not a bare profile — so the
 *    plugin's `getUserInfo` hook unwraps it. A bare fetch would produce a user with
 *    no id at all, and Better Auth would create an account with an empty subject.
 * 2. The user token travels in an `Authorization: Bearer` header, not a query string.
 * 3. **Email is not a usable identity.** It arrives only with `contact:user.email:readonly`,
 *    and Feishu's own documentation says it is admin-imported and "not recommended as a
 *    login credential". The stable id is `union_id` — the same value for one person
 *    across every app under the same ISV — so that is the account subject, and a
 *    deployment that did not grant the email scope still gets a working sign-in.
 */
function feishuProvider(credentials: { clientId: string; clientSecret: string }) {
  return {
    providerId: 'feishu',
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    authorizationUrl: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize',
    tokenUrl: 'https://accounts.feishu.cn/oauth/v3/token',
    userInfoUrl: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
    // Feishu rejects a code_verifier it never issued a challenge for, and the plugin
    // sends one by default.
    pkce: false,
    // Better Auth insists a user has an email, and Feishu only sends one with
    // `contact:user.email:readonly` — a scope its own documentation calls admin-imported
    // and unfit as a login credential. So people without the scope get a placeholder
    // under \`.invalid\` (RFC 2606: guaranteed never to resolve, so nothing can be mailed
    // to a stranger by accident). It is derived from the subject, so it is stable per
    // person rather than random.
    //
    // Measured: without this, the callback ends in
    // "Provider \"feishu\" did not return an email" and no user is created at all.
    // (An earlier version of this file claimed the email scope was simply unnecessary.
    // It is — for identity. It is not, for Better Auth's user row.)
    mapProfileToUser: (profile: {
      id?: string | number | null;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    }) => ({
      email: profile.email ?? `${profile.id ?? 'unknown'}@feishu.invalid`,
      ...(profile.name ? { name: profile.name } : {}),
      ...(profile.image ? { image: profile.image } : {}),
    }),
    // Which field of the unwrapped profile is the person.
    accountSubject: (context: { profile?: Record<string, unknown> }) => {
      const profile = context.profile ?? {};
      const id = profile.union_id ?? profile.open_id ?? context.profile?.id;
      if (typeof id !== 'string' || !id) throw new Error('feishu profile has no union_id');
      return id;
    },
    async getUserInfo(tokens: { accessToken?: string | null }) {
      const res = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        headers: { Authorization: `Bearer ${tokens.accessToken ?? ''}` },
      });
      const body = (await res.json()) as {
        code?: number;
        msg?: string;
        data?: Record<string, unknown>;
      };
      if (!res.ok || body.code !== 0 || !body.data) {
        throw new Error(`feishu user_info failed: ${body.msg ?? res.status}`);
      }
      const { union_id, open_id, name, en_name, avatar_url, email } = body.data as {
        union_id?: string;
        open_id?: string;
        name?: string;
        en_name?: string;
        avatar_url?: string;
        email?: string;
      };
      // union_id is the tenant-stable one; open_id is the fallback when a tenant has
      // not enabled the ISV-level identity.
      const id = union_id ?? open_id;
      if (!id) throw new Error('feishu user_info returned no union_id or open_id');
      return {
        id,
        name: name ?? en_name ?? undefined,
        email: email ?? undefined,
        image: avatar_url ?? undefined,
        emailVerified: false,
      };
    },
  };
}

export function createAuth(options: AuthOptions): Auth {
  return betterAuth(authOptions(options));
}

/**
 * Create Better Auth's tables in the deployment's own database.
 *
 * The plan comes from Better Auth itself (\`getMigrations\`) rather than from a
 * checked-in SQL file: the schema then follows the library's version instead of
 * drifting from it, and the DDL is generated from the same options the instance
 * runs with. Better Auth checks the result on every start, so a wrong table is a
 * loud failure rather than a mysterious 500.
 */
export async function applyAuthSchema(options: AuthOptions): Promise<string[]> {
  const plan = await getMigrations(authOptions(options), { throwOnUnsafe: false });
  const created: string[] = [];
  for (const table of plan.toBeCreated) {
    const columns = Object.entries(table.fields).map(([name, field]) => columnSql(name, field));
    // The primary key is implicit in Better Auth's model: every table has an
    // `id` and every query filters on it, and the plan lists it as a field only
    // sometimes. Added only when the plan does not, or the column would repeat and
    // the CREATE TABLE would fail — which Better Auth then reports as "missing
    // columns: user.id", with no table in sight.
    const keyed = 'id' in table.fields ? columns : ['"id" TEXT PRIMARY KEY NOT NULL', ...columns];
    options.sql.exec(`CREATE TABLE IF NOT EXISTS "${table.table}" (${keyed.join(', ')})`);
    created.push(table.table);
  }
  return created;
}

type FieldLike = {
  // Better Auth types this as a union of literals (or a list of them); the
  // affinity only needs to know whether it is numeric or textual.
  type: unknown;
  required?: boolean;
  unique?: boolean;
  fieldName?: string;
  references?: { model: string; field: string };
};

function columnSql(name: string, field: FieldLike): string {
  // Better Auth's own type names, mapped to what SQLite has: dates are stored as
  // text (ISO strings), booleans as 0/1, exactly as the library reads them back.
  const kind = Array.isArray(field.type) ? String(field.type[0]) : String(field.type);
  // Better Auth checks the DECLARED type on start, so these names are its
  // vocabulary, not a preference: `date` is stored as text either way, but a
  // column declared TEXT is reported as a mismatch and warned about on every boot.
  const affinity =
    kind === 'number' || kind === 'boolean' ? 'INTEGER' : kind === 'date' ? 'DATE' : 'TEXT';
  const parts = [`"${field.fieldName ?? name}"`, affinity];
  if (field.required) parts.push('NOT NULL');
  if (field.unique) parts.push('UNIQUE');
  if (field.references) {
    parts.push(`REFERENCES "${field.references.model}"("${field.references.field}")`);
  }
  return parts.join(' ');
}

export type { Auth };
