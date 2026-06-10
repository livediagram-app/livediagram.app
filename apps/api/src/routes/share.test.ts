import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// `passwordGate` is the route-side helper that translates a
// password-protected diagram + visitor-supplied password into one of
// three outcomes: access allowed (null), `password_required` 401 (no
// password supplied yet), or `password_invalid` 403 (supplied the
// wrong one). The live editor's SharePasswordGate component
// distinguishes the two error codes verbatim, so a regression that
// swapped 401 and 403, or that changed the error body shape, would
// break the gate UI silently: a visitor who never entered a password
// would see "wrong password", or a wrong-password visitor would loop
// back to the prompt without an error message. These cases pin the
// mapping.
//
// `getDiagramSharePassword` is the only db helper the gate reaches
// for, so the mock factory below stubs it and the test drives the
// three branches by setting the stubbed return value per case.

const getSharePasswordMock = vi.fn<(env: Env, id: string) => Promise<string | null>>();
vi.mock('../db', () => ({
  // Real exports under '../db' that share.ts imports. Only
  // getDiagramSharePassword is consulted by passwordGate; the rest
  // need stub entries so the share.ts module can finish evaluating
  // its top-level imports.
  getDiagram: vi.fn(),
  getDiagramSharePassword: (env: Env, id: string) => getSharePasswordMock(env, id),
  getShareLink: vi.fn(),
  recordSharedAccess: vi.fn(),
}));

// Import AFTER the mock so the share.ts module picks up the stubbed
// db helpers. passwordGate is module-private to share.ts, exported
// only for this suite (see the comment on the export).
import { passwordGate } from './share';

const FAKE_ENV = {} as Env;

beforeEach(() => {
  getSharePasswordMock.mockReset();
});

describe('passwordGate (spec/24 status-code mapping)', () => {
  it('returns null when the diagram has no password (gate is a no-op)', async () => {
    getSharePasswordMock.mockResolvedValue(null);
    const result = await passwordGate(FAKE_ENV, 'diag-1', null);
    expect(result).toBeNull();
  });

  it('returns null when the diagram has no password and a password is supplied anyway', async () => {
    // The owner clears the password while a visitor is mid-session
    // still holding the old one. The gate must not reject them with
    // 403 here; "no password required" wins regardless of what they
    // sent.
    getSharePasswordMock.mockResolvedValue(null);
    const result = await passwordGate(FAKE_ENV, 'diag-2', 'leftover-from-old-session');
    expect(result).toBeNull();
  });

  it('returns 401 password_required when a password is set but the visitor supplied none', async () => {
    // SharePasswordGate distinguishes 401 (show the entry prompt
    // without an error message: the visitor hasn't tried yet) from
    // 403 (show "wrong password"). Swapping the two would surface a
    // confusing error to a first-time visitor.
    getSharePasswordMock.mockResolvedValue('hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-3', null);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    expect(await result!.json()).toEqual({ error: 'password_required' });
  });

  it('returns 403 password_invalid when the visitor supplied the wrong password', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-4', 'wrong');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    expect(await result!.json()).toEqual({ error: 'password_invalid' });
  });

  it('returns null when the visitor supplied the exact matching password (allowed through)', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-5', 'hunter2');
    expect(result).toBeNull();
  });

  it('treats an empty-string password as a real attempt that fails (403, not 401)', async () => {
    // Edge case: the client could in principle send X-Share-Password
    // with an empty value (e.g. after the user clears the input).
    // That counts as "the visitor tried and got it wrong", not "the
    // visitor never tried" — passwordGate uses != null, so '' is
    // treated as an attempted-but-wrong password. Pins the boundary.
    getSharePasswordMock.mockResolvedValue('hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-6', '');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    expect(await result!.json()).toEqual({ error: 'password_invalid' });
  });

  it('does case-sensitive password comparison (off-by-one capitalisation 403s)', async () => {
    // Cheap regression guard: a future "normalize whitespace +
    // case" change to the comparison would be a security
    // weakening. Asserting case sensitivity here pins the contract.
    getSharePasswordMock.mockResolvedValue('Hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-7', 'hunter2');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});
