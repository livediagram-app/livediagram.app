import { describe, expect, it, vi } from 'vitest';
import { IndexError } from './client';
import { createOrResumeItem } from './create-or-resume';
import type { GrantResponse } from './types';

// one-explorer-contracts.md "A create that resumes": a Retry after a failed content create takes up the item the
// first try made, when it is the caller's own.
const grant = (level: GrantResponse['level'], token = 'g'): GrantResponse => ({
  grant: token,
  level,
  tabId: null,
  expiresAt: 1,
});
const input = { id: 'i1', app: 'livediagram', title: 'Asked' } as const;

describe('createOrResumeItem', () => {
  it('answers the made item’s grant and the title the index filed', async () => {
    const createItem = vi.fn(async () => ({
      item: { title: 'Filed' } as never,
      grant: grant('edit', 'made'),
    }));
    const grantOf = vi.fn(async () => null);
    await expect(createOrResumeItem({ createItem }, input, grantOf)).resolves.toEqual({
      grant: grant('edit', 'made'),
      title: 'Filed',
    });
    expect(createItem).toHaveBeenCalledWith(input);
    expect(grantOf).not.toHaveBeenCalled();
  });

  it('carries on with the caller’s edit grant when the item is already there', async () => {
    const createItem = vi.fn(async () => {
      throw new IndexError(409, 'item_exists');
    });
    const grantOf = vi.fn(async () => grant('edit', 'resumed'));
    await expect(createOrResumeItem({ createItem }, input, grantOf)).resolves.toEqual({
      grant: grant('edit', 'resumed'),
      title: 'Asked',
    });
    expect(grantOf).toHaveBeenCalledWith('i1');
    const untitled = { id: 'i2', app: 'livediagram' } as const;
    await expect(createOrResumeItem({ createItem }, untitled, grantOf)).resolves.toMatchObject({
      title: '',
    });
  });

  it('throws the create’s error when the item is not the caller’s to edit', async () => {
    const exists = new IndexError(409, 'item_exists');
    const createItem = vi.fn(async () => {
      throw exists;
    });
    await expect(createOrResumeItem({ createItem }, input, async () => null)).rejects.toBe(exists);
    await expect(createOrResumeItem({ createItem }, input, async () => grant('view'))).rejects.toBe(
      exists,
    );
  });

  it('asks for no grant on any other refusal, and passes a non-index error through', async () => {
    const grantOf = vi.fn(async () => grant('edit'));
    for (const err of [
      new IndexError(403, 'team_forbidden'),
      new IndexError(409, 'folder_conflict'),
      new Error('offline'),
    ]) {
      const createItem = vi.fn(async () => {
        throw err;
      });
      await expect(createOrResumeItem({ createItem }, input, grantOf)).rejects.toBe(err);
    }
    expect(grantOf).not.toHaveBeenCalled();
  });
});
