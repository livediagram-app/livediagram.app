// Every unit test runs without the index's grants (lib/api/design-grants.ts): a request about a design goes out as the
// test sent it, with no grant request ahead of it in the stubbed fetch. The grants' own behaviour is tested in
// lib/api/design-grants.test.ts, which takes the real module back with `vi.unmock`.
import { vi } from 'vitest';

vi.mock('@/lib/api/design-grants', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/api/design-grants')>()),
  designGrant: async () => null,
  keepDesignGrantFresh: () => () => {},
  withDesignGrant: async (_base: string, _input: string, init?: RequestInit) => init,
}));
