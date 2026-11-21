// @vitest-environment jsdom

// Verification in the page tree (docs/specs/030-knowledgebase/verification.md): the tick or pill in a row, and
// Verify and Always in Context in its menu, a share role at a time.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@liveknowledge/api-schema';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { knowledgeRights } from '@/lib/knowledge/knowledge-rights';
import { trustMarks } from '@/lib/knowledge/page-trust';
import { PageTree, type PageTreeActions, type PageTreeKnowledge } from './PageTree';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 12);
const TABS = [
  { id: 'a', name: 'Handbook', knowledge: { verifiedAt: NOW - DAY, verifiedBy: 'u1' } },
  { id: 'b', name: 'Release Process', parent: 'a', knowledge: { verifiedAt: NOW - 200 * DAY } },
  { id: 'c', name: 'Notes', knowledge: { context: true as const } },
];

const actions = (): PageTreeActions => ({
  onSelect: vi.fn(),
  onRename: vi.fn(),
  onAdd: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
  onStep: vi.fn(),
  onIndent: vi.fn(),
  onOutdent: vi.fn(),
  onCopyLink: vi.fn(),
});

function mount(level: AccessLevel) {
  const can = resolveEditorCapabilities(level);
  const rights = knowledgeRights({
    can,
    isStructureReadOnly: level === 'view',
    offline: false,
  });
  const knowledge: PageTreeKnowledge = {
    marks: trustMarks(TABS, 90, NOW),
    inContext: new Set(['c']),
    canVerify: rights.verify,
    canEditFields: rights.editFields,
    onVerify: vi.fn(),
    onSetContext: vi.fn(),
  };
  render(
    <PageTree
      tabs={TABS}
      activeId="a"
      closed={new Set()}
      onSetOpen={vi.fn()}
      canEdit={can.editPages}
      actions={actions()}
      knowledge={knowledge}
    />,
  );
  return knowledge;
}

const row = (name: string) => screen.getByRole('treeitem', { name });
const openMenu = (name: string, title: string) => {
  fireEvent.pointerOver(row(name));
  fireEvent.click(within(row(name)).getByRole('button', { name: `Page Options for ${title}` }));
};
// A toolbar button is named by its label alone; a row by its words.
const menuItems = () =>
  screen
    .getAllByRole('menuitem')
    .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '');

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a row’s verified state', () => {
  it('shows the tick or the pill at the row’s right and says it in the row’s name', () => {
    mount('view');
    expect(within(row('Handbook, Verified')).getByRole('img', { name: 'Verified' })).toBeTruthy();
    expect(
      within(row('Release Process, Review Due')).getByRole('img', { name: 'Review Due' }),
    ).toBeTruthy();
    // Never verified: nothing.
    expect(within(row('Notes')).queryByRole('img')).toBeNull();
  });
});

describe('the row menu', () => {
  it('an Editor verifies a page and takes it in and out of Always in Context', () => {
    const knowledge = mount('edit');
    openMenu('Release Process, Review Due', 'Release Process');
    expect(menuItems()).toEqual(expect.arrayContaining(['Verify', 'Always in Context']));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Verify' }));
    expect(knowledge.onVerify).toHaveBeenCalledWith('b');
    openMenu('Release Process, Review Due', 'Release Process');
    expect(document.querySelector('[data-checked]')).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Always in Context' }));
    expect(knowledge.onSetContext).toHaveBeenCalledWith('b', true);
    // A page already in context shows the checkmark, and a press takes it out.
    openMenu('Notes', 'Notes');
    expect(document.querySelector('[data-checked]')).not.toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Always in Context' }));
    expect(knowledge.onSetContext).toHaveBeenLastCalledWith('c', false);
  });

  it('a guest Editor verifies too (it reads "Guest") and sets Always in Context', () => {
    mount('edit');
    openMenu('Notes', 'Notes');
    expect(menuItems()).toEqual(expect.arrayContaining(['Verify', 'Always in Context']));
  });

  it('a participate session verifies and sets Always in Context, as an Editor', () => {
    mount('participate');
    openMenu('Notes', 'Notes');
    expect(menuItems()).toEqual(expect.arrayContaining(['Verify', 'Always in Context']));
  });

  it.each(['view'] as const)('a %s session has neither', (level) => {
    mount(level);
    openMenu('Notes', 'Notes');
    expect(menuItems()).toEqual(['Copy Link']);
  });
});
