// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TAG_LIMIT, type Tag, type TagsList } from '@livedesign/api-schema';
import { tagNameProblem, useDocumentTagsState } from './useDocumentTagsState';

// docs/specs/013-workspace/tags.md "Optimistic changes": every change shows at once, the request goes behind it, and
// a failed request puts the change back and says so.

const api = vi.hoisted(() => ({
  apiListTags: vi.fn<(owner: string) => Promise<TagsList>>(),
  apiCreateTag: vi.fn(),
  apiUpdateTag: vi.fn(),
  apiDeleteTag: vi.fn(),
  apiSetDocumentTag: vi.fn(),
}));
vi.mock('@/lib/api/tags', () => ({ ...api, tagErrorCopy: () => 'Could not save.' }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const tag = (id: string, name: string, colour = 'blue'): Tag => ({
  id,
  name,
  colour,
  createdAt: 1,
});

beforeEach(() => {
  api.apiListTags.mockResolvedValue({
    tags: [tag('t2', 'research'), tag('t1', 'Design')],
    links: [
      { tagId: 't1', documentId: 'd1' },
      { tagId: 't2', documentId: 'd1' },
      { tagId: 't1', documentId: 'd2' },
    ],
  });
  for (const fn of [api.apiCreateTag, api.apiUpdateTag, api.apiDeleteTag, api.apiSetDocumentTag]) {
    fn.mockResolvedValue(undefined);
  }
});
afterEach(() => vi.clearAllMocks());

async function ready(owner: string | null = 'u1', enabled = true) {
  const hook = renderHook(({ o, e }) => useDocumentTagsState(o, e), {
    initialProps: { o: owner, e: enabled },
  });
  if (owner && enabled) await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  return hook;
}

describe('useDocumentTagsState', () => {
  it('loads tags alphabetically and indexes them both ways', async () => {
    const { result } = await ready();
    expect(result.current.tags.map((t) => t.name)).toEqual(['Design', 'research']);
    expect(result.current.tagsFor('d1').map((t) => t.id)).toEqual(['t1', 't2']);
    expect([...result.current.documentsFor('t1')]).toEqual(['d1', 'd2']);
    expect(result.current.tagsFor('nothing')).toEqual([]);
  });

  it('loads nothing until asked when lazy', async () => {
    const { result } = await ready('u1', false);
    expect(result.current.status).toBe('idle');
    expect(api.apiListTags).not.toHaveBeenCalled();
    act(() => result.current.request());
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('says so when the list fails, so no tags never reads as none', async () => {
    api.apiListTags.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useDocumentTagsState('u1', true));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('puts a tag on and takes it off at once, the request behind', async () => {
    const { result } = await ready();
    act(() => result.current.setDocumentTag('d2', 't2', true));
    expect(result.current.tagsFor('d2').map((t) => t.id)).toEqual(['t1', 't2']);
    await waitFor(() => expect(api.apiSetDocumentTag).toHaveBeenCalledWith('u1', 't2', 'd2', true));
    act(() => result.current.setDocumentTag('d2', 't1', false));
    expect(result.current.tagsFor('d2').map((t) => t.id)).toEqual(['t2']);
    expect(track).toHaveBeenCalledWith('Explorer', 'Added', 'Tag');
    expect(track).toHaveBeenCalledWith('Explorer', 'Removed', 'Tag');
  });

  it('puts a failed link back and says so', async () => {
    api.apiSetDocumentTag.mockRejectedValueOnce(new Error('500'));
    const { result } = await ready();
    act(() => result.current.setDocumentTag('d2', 't2', true));
    await waitFor(() => expect(result.current.tagsFor('d2').map((t) => t.id)).toEqual(['t1']));
    expect(toast.error).toHaveBeenCalledWith('Could not save.');
  });

  it('creates with the next colour, applies it, and links only after the create lands', async () => {
    let land!: () => void;
    api.apiCreateTag.mockReturnValueOnce(new Promise<void>((r) => (land = r)));
    const { result } = await ready();
    let made: Tag | null = null;
    act(() => {
      made = result.current.createTag('  Client  work ', { applyTo: 'd2' });
    });
    expect(made).toMatchObject({ name: 'Client work', colour: 'green' });
    expect(result.current.tags.map((t) => t.name)).toEqual(['Client work', 'Design', 'research']);
    expect(result.current.tagsFor('d2').map((t) => t.name)).toContain('Client work');
    // The link waits for the tag's row.
    await Promise.resolve();
    expect(api.apiSetDocumentTag).not.toHaveBeenCalled();
    await act(async () => land());
    await waitFor(() =>
      expect(api.apiSetDocumentTag).toHaveBeenCalledWith('u1', made!.id, 'd2', true),
    );
  });

  it('refuses a taken name, an empty one, and past the limit, sending nothing', async () => {
    const { result } = await ready();
    act(() => {
      expect(result.current.createTag('design')).toBeNull();
      expect(result.current.createTag('   ')).toBeNull();
    });
    expect(api.apiCreateTag).not.toHaveBeenCalled();
    api.apiListTags.mockResolvedValueOnce({
      tags: Array.from({ length: TAG_LIMIT }, (_, i) => tag(`t${i}`, `Tag ${i}`)),
      links: [],
    });
    await act(async () => result.current.reload());
    act(() => expect(result.current.createTag('One more')).toBeNull());
  });

  it('takes a failed create back off, links included, and never links it', async () => {
    api.apiCreateTag.mockRejectedValueOnce(new Error('409'));
    const { result } = await ready();
    act(() => {
      result.current.createTag('Fresh', { applyTo: 'd1' });
    });
    await waitFor(() => expect(result.current.tags.map((t) => t.name)).not.toContain('Fresh'));
    expect(result.current.tagsFor('d1').map((t) => t.name)).toEqual(['Design', 'research']);
    expect(api.apiSetDocumentTag).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('renames and recolours, keeping the order alphabetical, and reverts a failure', async () => {
    const { result } = await ready();
    act(() => result.current.updateTag('t1', { name: 'Zebra', colour: '#123456' }));
    expect(result.current.tags.map((t) => t.name)).toEqual(['research', 'Zebra']);
    expect(api.apiUpdateTag).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(api.apiUpdateTag).toHaveBeenCalledWith('u1', 't1', {
        name: 'Zebra',
        colour: '#123456',
      }),
    );
    expect(track).toHaveBeenCalledWith('Explorer', 'Renamed', 'Tag');
    expect(track).toHaveBeenCalledWith('Explorer', 'Changed', 'TagColour');

    api.apiUpdateTag.mockRejectedValueOnce(new Error('500'));
    act(() => result.current.updateTag('t2', { colour: 'red' }));
    await waitFor(() => expect(result.current.tagById.get('t2')?.colour).toBe('blue'));
  });

  it('ignores a rename to a taken name', async () => {
    const { result } = await ready();
    act(() => result.current.updateTag('t1', { name: 'RESEARCH' }));
    expect(result.current.tagById.get('t1')?.name).toBe('Design');
    expect(api.apiUpdateTag).not.toHaveBeenCalled();
  });

  it('deletes a tag and its links, restoring both if the delete fails', async () => {
    api.apiDeleteTag.mockRejectedValueOnce(new Error('500'));
    const { result } = await ready();
    act(() => result.current.deleteTag('t1'));
    expect(result.current.tags.map((t) => t.id)).toEqual(['t2']);
    expect(result.current.tagsFor('d2')).toEqual([]);
    await waitFor(() => expect(result.current.tagsFor('d2').map((t) => t.id)).toEqual(['t1']));
    expect(result.current.tags.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('drops everything when the owner goes', async () => {
    const { result, rerender } = await ready();
    rerender({ o: null, e: true });
    expect(result.current.tags).toEqual([]);
    expect(result.current.status).toBe('idle');
  });
});

describe('tagNameProblem', () => {
  const tags = [tag('t1', 'Design')];
  it('says why a name cannot be used', () => {
    expect(tagNameProblem('', tags)).toBe('Give the tag a name');
    expect(tagNameProblem('x'.repeat(33), tags)).toBe('Keep the name to 32 characters');
    expect(tagNameProblem(' design ', tags)).toBe('You already have a tag called Design');
    expect(tagNameProblem('Design', tags, 't1')).toBeNull();
    expect(tagNameProblem('Research', tags)).toBeNull();
  });
});
