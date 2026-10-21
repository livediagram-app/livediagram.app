import type { Page } from '@playwright/test';

// A fake clerk-js for the signed-in e2e specs (docs/specs/014-identity/blueprints/profile-picture.md).
//
// @clerk/react hot-loads clerk-js from the publishable key's host, but skips the download when
// `window.Clerk` already exists. Installing this before any page script runs therefore puts a
// chosen signed-in user behind the real @clerk/react hooks, with no Clerk account. Its session
// tokens come from the e2e stack (`/e2e/token`, E2E_CLERK_JWKS), which the api worker verifies,
// so the user is a real verified account to the api and the realtime room.
// It implements only what those hooks read: `load`, `addListener`, the emitted resources, the
// session's `getToken` and `signOut`. `status` is left undefined so @clerk/react marks itself
// ready once `load` resolves, as it does for an older clerk-js.
//
// Runs against the Clerk-enabled export (`pnpm build:clerk-stub`); the guest-mode `out/` never
// mounts Clerk at all.

export type StubUser = {
  // The Clerk user id; defaults to `user_stub`.
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  hasImage: boolean;
  imageUrl: string;
  externalAccounts: { provider: string; imageUrl: string }[];
};

// `null` installs a Clerk with nobody signed in: an anonymous visitor on a Clerk deployment.
export async function installClerkStub(page: Page, user: StubUser | null): Promise<void> {
  await page.addInitScript((u: StubUser | null) => {
    if (!u) {
      const empty = {
        client: { sessions: [], activeSessions: [] },
        session: null,
        user: null,
        organization: null,
      };
      const listeners = new Set<(r: typeof empty) => void>();
      const clerk = {
        loaded: false,
        version: 'stub',
        client: empty.client,
        session: null,
        user: null,
        organization: null,
        isSignedIn: false,
        __internal_lastEmittedResources: undefined as typeof empty | undefined,
        async load() {
          clerk.loaded = true;
          clerk.__internal_lastEmittedResources = empty;
          for (const l of listeners) l(empty);
        },
        addListener(cb: (r: typeof empty) => void, opts?: { skipInitialEmit?: boolean }) {
          listeners.add(cb);
          if (clerk.loaded && !opts?.skipInitialEmit) cb(empty);
          return () => listeners.delete(cb);
        },
        signOut: async () => {},
      };
      Object.assign(window, { Clerk: clerk, __internal_ClerkUICtor: function ClerkUIStub() {} });
      return;
    }
    const id = u.id ?? 'user_stub';
    const userResource = {
      id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName} ${u.lastName}`,
      username: null,
      primaryEmailAddress: { emailAddress: u.email },
      createdAt: new Date('2026-01-15T12:00:00Z'),
      hasImage: u.hasImage,
      imageUrl: u.imageUrl,
      externalAccounts: u.externalAccounts,
      organizationMemberships: [],
      delete: async () => {},
      reload: async () => userResource,
    };
    const session = {
      id: `sess_${id}`,
      status: 'active',
      user: userResource,
      actor: null,
      // @clerk/react counts a session as signed in only once it has claims.
      lastActiveToken: { jwt: { claims: { sub: id, sid: `sess_${id}` } } },
      factorVerificationAge: null,
      getToken: async () => (await fetch(`/e2e/token?sub=${id}`)).text(),
    };
    const resources = {
      client: { sessions: [session], activeSessions: [session] },
      session,
      user: userResource,
      organization: null,
    };
    const listeners = new Set<(r: typeof resources) => void>();
    const clerk = {
      loaded: false,
      version: 'stub',
      client: resources.client,
      session,
      user: userResource,
      organization: null,
      isSignedIn: true,
      __internal_lastEmittedResources: undefined as typeof resources | undefined,
      async load() {
        clerk.loaded = true;
        clerk.__internal_lastEmittedResources = resources;
        for (const l of listeners) l(resources);
      },
      addListener(cb: (r: typeof resources) => void, opts?: { skipInitialEmit?: boolean }) {
        listeners.add(cb);
        if (clerk.loaded && !opts?.skipInitialEmit) cb(resources);
        return () => listeners.delete(cb);
      },
      signOut: async () => {},
    };
    Object.assign(window, { Clerk: clerk, __internal_ClerkUICtor: function ClerkUIStub() {} });
  }, user);
}

/** A stand-in picture: a flat disc of colour, served as SVG from Clerk's image host. */
export const STUB_PICTURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#f59e0b"/><circle cx="48" cy="38" r="18" fill="#7c2d12"/><path d="M14 96c4-22 18-32 34-32s30 10 34 32z" fill="#7c2d12"/></svg>`;

/**
 * A target (red rim, green ring, blue centre) standing in for a square Google picture, answered
 * the way Clerk's image host answers (measured, docs/specs/014-identity/profile-picture.md §2): a
 * size alone gives the full square; `fit=crop` gives a 160x96 band through the middle, which a
 * round disc then crops again. The rim is what a correctly framed disc shows at its edge.
 */
export const TARGET_RIM = { r: 239, g: 68, b: 68 };
export function clerkTargetPicture(url: string): string {
  const crop = new URL(url).searchParams.get('fit') === 'crop';
  const [w, h, viewBox] = crop ? [160, 96, '0 20 100 60'] : [96, 96, '0 0 100 100'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="none"><rect width="100" height="100" fill="rgb(${TARGET_RIM.r},${TARGET_RIM.g},${TARGET_RIM.b})"/><circle cx="50" cy="50" r="38" fill="#22c55e"/><circle cx="50" cy="50" r="24" fill="#3b82f6"/></svg>`;
}

/**
 * A fresh Clerk-shaped user id. The stack's D1 outlives a test, and an account's synced
 * preferences with it, so a test that flips a setting takes an account nobody else uses.
 */
export function freshUserId(name: string): string {
  return `user_${name}${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}
