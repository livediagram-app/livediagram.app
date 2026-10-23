// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagsList } from '@livedesign/api-schema';
import { DesignTagsProvider, useDesignTags } from './DesignTagsProvider';
import { TagPicker } from './TagPicker';

// docs/specs/013-workspace/tags.md "The tag picker".

const api = vi.hoisted(() => ({
  apiListTags: vi.fn<(owner: string) => Promise<TagsList>>(),
  apiCreateTag: vi.fn(async () => undefined),
  apiUpdateTag: vi.fn(async () => undefined),
  apiDeleteTag: vi.fn(async () => undefined),
  apiSetDesignTag: vi.fn(async () => undefined),
}));
vi.mock('@/lib/api/tags', () => ({ ...api, tagErrorCopy: () => 'Could not save.' }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const go = vi.hoisted(() => vi.fn());
vi.mock('@/app/explorer/ExplorerContext', () => ({ useOptionalExplorer: () => ({ go }) }));

beforeEach(() => {
  api.apiListTags.mockResolvedValue({
    tags: [
      { id: 't1', name: 'Design', colour: 'blue', createdAt: 1 },
      { id: 't2', name: 'Research', colour: 'green', createdAt: 2 },
    ],
    links: [{ tagId: 't1', designId: 'd1' }],
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// What the design carries, as the provider sees it.
function Carried() {
  const { tagsFor } = useDesignTags();
  return (
    <output data-testid="carried">
      {tagsFor('d1')
        .map((t) => t.name)
        .join(',')}
    </output>
  );
}

async function open() {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const onClose = vi.fn();
  render(
    <DesignTagsProvider ownerId="u1">
      <Carried />
      <TagPicker target={{ designId: 'd1', designName: 'Roadmap', anchor }} onClose={onClose} />
    </DesignTagsProvider>,
  );
  await screen.findByRole('checkbox', { name: /Design/ });
  return { onClose };
}

const carried = () => screen.getByTestId('carried').textContent;

describe('TagPicker', () => {
  it('is named for the design and ticks the tags it carries', async () => {
    await open();
    expect(screen.getByRole('dialog', { name: 'Tags for Roadmap' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Design/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('checkbox', { name: /Research/ }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('ticks a tag on and off at once', async () => {
    await open();
    fireEvent.click(screen.getByRole('checkbox', { name: /Research/ }));
    expect(carried()).toBe('Design,Research');
    fireEvent.click(screen.getByRole('checkbox', { name: /Design/ }));
    expect(carried()).toBe('Research');
    await waitFor(() => expect(api.apiSetDesignTag).toHaveBeenCalledTimes(2));
  });

  it('narrows by typing and offers Create for a new name', async () => {
    await open();
    const field = screen.getByRole('textbox', { name: 'Find or create a tag' });
    fireEvent.change(field, { target: { value: 'res' } });
    expect(screen.queryByRole('checkbox', { name: /Design/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Research/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create “res”/ })).toBeTruthy();
  });

  it('never offers Create for a name it already has, in any case', async () => {
    await open();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'DESIGN' } });
    expect(screen.queryByRole('button', { name: /Create/ })).toBeNull();
  });

  it('Enter makes the tag, puts it on and clears the field', async () => {
    await open();
    const field = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'Q3' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(carried()).toBe('Design,Q3');
    expect(field.value).toBe('');
    await waitFor(() =>
      expect(api.apiCreateTag).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Q3' })),
    );
  });

  it('Enter on an exact name toggles that tag', async () => {
    await open();
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'research' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(carried()).toBe('Design,Research');
    expect(api.apiCreateTag).not.toHaveBeenCalled();
  });

  it('moves between the field and the rows with the arrows', async () => {
    await open();
    const field = screen.getByRole('textbox');
    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: /Design/ }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: /Research/ }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(field);
  });

  it('says when a name is too long instead of offering it', async () => {
    await open();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x'.repeat(40) } });
    expect(screen.getByText("Keep a tag's name to 32 characters.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Create/ })).toBeNull();
  });

  it('Manage Tags closes and opens the Tags page', async () => {
    const { onClose } = await open();
    fireEvent.click(screen.getByRole('button', { name: 'Manage Tags' }));
    expect(onClose).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith({ kind: 'tags' });
  });
});

describe('TagPicker with no tags', () => {
  it('says how to make the first', async () => {
    api.apiListTags.mockResolvedValue({ tags: [], links: [] });
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(
      <DesignTagsProvider ownerId="u1">
        <TagPicker target={{ designId: 'd1', designName: '', anchor }} onClose={() => {}} />
      </DesignTagsProvider>,
    );
    expect(await screen.findByText('No tags yet')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Tags for Untitled design' })).toBeTruthy();
  });
});
