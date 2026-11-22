import { describe, expect, it } from 'vitest';
import { knowledgeKit } from '../routes/knowledge-test-kit';
import type { DocumentEnv } from '../types';
import { tokenRoomRole, writeScopes } from './agent-grants';

// docs/specs/024-agents/knowledgebase-for-agents.md "Share roles": a token's socket writes only with `write`.
describe('tokenRoomRole', () => {
  it("keeps a person's own role, and a token's only once an Editor granted it write", async () => {
    const kit = await knowledgeKit();
    const env = kit.db.env;
    expect(await tokenRoomRole(env, 'edit', null)).toBe('edit');
    expect(await tokenRoomRole(env, undefined, 'tok_1')).toBeUndefined();
    expect(await tokenRoomRole(env, 'view', 'tok_1')).toBe('view');
    // Nobody decided: `read` and `suggest`, which write no page.
    expect(await tokenRoomRole(env, 'edit', 'tok_1')).toBe('view');
    await writeScopes(env, 'tok_1', ['read', 'suggest', 'write']);
    expect(await tokenRoomRole(env, 'edit', 'tok_1')).toBe('edit');
    // `write` is an Editor's agent's alone.
    expect(await tokenRoomRole(env, 'participate', 'tok_1')).toBe('view');
    await writeScopes(env, 'tok_1', ['read']);
    expect(await tokenRoomRole(env, 'edit', 'tok_1')).toBe('view');
  });

  it('watches when the grant cannot be read', async () => {
    const broken = {
      DOCUMENT_DB: {
        prepare: () => {
          throw new Error('no such table');
        },
      },
    } as unknown as DocumentEnv;
    expect(await tokenRoomRole(broken, 'edit', 'tok_1')).toBe('view');
  });
});
