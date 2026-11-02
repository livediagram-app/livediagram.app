// The accounts Worker as repeating cards' tests stand it in (vi.mock of ../auth/accounts, test-repeat-world.ts): its own
// module, importing nothing, so a hoisted mock factory can load it before the worker.
export const OWNER = 'guest_owner';

// `Bearer guest:<id>` stands in for a verified guest token (mocked over ../auth/accounts).
export const accountsMock = {
  getPersonIdentity: async (_env: unknown, request: Request) => {
    const bearer = request.headers.get('Authorization') ?? '';
    return {
      kind: 'guest',
      guestId: bearer.startsWith('Bearer guest:') ? bearer.slice(13) : OWNER,
    };
  },
  accountCredentials: () => null,
};
