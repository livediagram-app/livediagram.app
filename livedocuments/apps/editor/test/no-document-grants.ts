// Every unit test runs without the index's grants (lib/api/document-grants.ts): a request about a plan goes out as the
// test sent it, with no grant request ahead of it in the stubbed fetch. The grants' own behaviour is tested in
// lib/api/document-grants.test.ts, which takes the real module back with `vi.unmock`.
import { vi } from 'vitest';

vi.mock('@/lib/api/document-grants', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/api/document-grants')>()),
  documentGrant: async () => null,
  keepDocumentGrantFresh: () => () => {},
  withDocumentGrant: async (_base: string, _input: string, init?: RequestInit) => init,
}));
