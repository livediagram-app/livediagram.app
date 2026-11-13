// @vitest-environment jsdom

// Describe a Plan on Start Planning's rail (docs/specs/026-plan/describe-a-plan.md "Where it starts"): an Editor's
// entry in the foot group above Connect File and Import, with the sparkle, opening its dialog and placing nothing; a
// Participant or Viewer sees none. A search finds its card under its own heading.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCommunityEnabledForTests } from '@liveworkspace/community-ui';
import { resetCommunityStartForTests } from '@liveworkspace/community-ui/start';
import { StartPlanning } from './StartPlanning';

vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
let connectOffered = true;
vi.mock('@/components/connect/useConnectStart', () => ({
  useConnectStart: () => (connectOffered ? () => <p>Connect list</p> : undefined),
}));

beforeEach(() => {
  connectOffered = true;
  resetCommunityStartForTests();
  resetCommunityEnabledForTests();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ categories: {}, communityEnabled: false })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// EditorStartPanels gives `onDescribe` to an Editor only, as it gives `onImport`.
const ROLES = { editor: true, participant: false, viewer: false } as const;

const mount = (editor: boolean) => {
  const onDescribe = vi.fn();
  const onImport = vi.fn();
  const onPickBoard = vi.fn();
  render(
    <StartPlanning
      onPickBoard={onPickBoard}
      onImport={editor ? onImport : undefined}
      onDescribe={editor ? onDescribe : undefined}
    />,
  );
  return { onDescribe, onImport, onPickBoard };
};

const rail = () => screen.getByRole('navigation', { name: 'Categories' });
const railIds = () =>
  [...rail().querySelectorAll<HTMLElement>('[data-rail]')].map((b) => b.dataset.rail);
const entry = () => within(rail()).getByRole('button', { name: 'Describe a Plan' });
const search = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: /Find a board/ }), { target: { value } });

describe('Start Planning: Describe a Plan on the rail', () => {
  it('leads the foot group, above Connect File and Import, with the sparkle', () => {
    mount(ROLES.editor);
    const connect = within(rail()).getByRole('button', { name: 'Connect File' });
    expect(entry().parentElement).toBe(connect.parentElement);
    expect(railIds().slice(-3)).toEqual(['describe', 'connect', 'import']);
    expect(entry().textContent).toBe('Describe a Plan');
    expect(entry().querySelector('svg')).not.toBeNull();
    expect(entry().getAttribute('aria-haspopup')).toBe('dialog');
    expect(connect.className).toContain('sm:mt-1');
  });

  it('opens its dialog and places nothing, the grid keeping what it shows', () => {
    const { onDescribe, onPickBoard } = mount(ROLES.editor);
    fireEvent.click(entry());
    expect(onDescribe).toHaveBeenCalledOnce();
    expect(onPickBoard).not.toHaveBeenCalled();
    expect(entry().getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('region', { name: 'Recommended' })).toBeTruthy();
  });

  it('heads the foot alone where Connect File is not offered', () => {
    connectOffered = false;
    mount(ROLES.editor);
    expect(railIds().slice(-2)).toEqual(['describe', 'import']);
    expect(entry().className).not.toContain('sm:mt-1');
    expect(entry().parentElement!.className).toContain('sm:border-t');
  });

  it.each(['participant', 'viewer'] as const)('shows a %s no entry and no card', (role) => {
    mount(ROLES[role]);
    expect(within(rail()).queryByRole('button', { name: 'Describe a Plan' })).toBeNull();
    search('describe');
    expect(screen.queryByRole('region', { name: 'Describe a Plan' })).toBeNull();
  });

  it.each(['describe', 'ai', 'custom', 'generate', 'my own'])(
    'is found by a search for %s, under its own heading, its card opening the dialog',
    (q) => {
      const { onDescribe } = mount(ROLES.editor);
      search(q);
      // Under its own heading, or the Best Match a name beginning with the words leads with.
      const group =
        q === 'describe'
          ? screen.getByRole('region', { name: 'Best Match' })
          : screen.getByRole('region', { name: 'Describe a Plan' });
      const card = group.querySelector<HTMLElement>('[data-start-card="describe"]');
      expect(card).not.toBeNull();
      // Its own name: no kind badge saying it again.
      expect(card!.textContent).toContain('Describe a Plan');
      fireEvent.click(card!);
      expect(onDescribe).toHaveBeenCalledOnce();
    },
  );
});
