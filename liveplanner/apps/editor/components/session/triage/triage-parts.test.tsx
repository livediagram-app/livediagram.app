// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import { decisionNote, undoLabel } from '../session-words';
import { CloseTray } from './CloseTray';
import { PriorityPill, TriageStrip, triageRows } from './TriageStrip';
import { duplicateLink, duplicateUnlink } from './triage-duplicate';

// docs/specs/026-plan/session-tabs.md "Bug Triage": the triage strip, the rows' priority pill, the close tray, the
// duplicate link and a decision in words.
afterEach(cleanup);

const bug: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  prefix: 'BUG',
  fields: ['title', 'status', 'priority', 'f-sev', 'f-dup'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
    { id: 'f-dup', label: 'Duplicate Of', kind: 'card', linkType: 'bug' },
    { id: 'f-dups', label: 'Duplicates', kind: 'card', linkType: 'bug', multiple: true },
  ],
};
const several: ItemTypeDef = { ...bug, fields: ['title', 'status', 'f-dups'] };
const card = (id: string, fields: Item['fields'] = {}, type = 'bug'): Item => ({
  id,
  type,
  key: id.charCodeAt(0),
  rank: id,
  fields: { title: `Card ${id.toUpperCase()}`, status: 'new', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: id.charCodeAt(0),
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});

describe('TriageStrip', () => {
  it('shows nothing for a type with neither Priority nor a severity-style field', () => {
    const plain = { ...bug, fields: ['title', 'status'] };
    expect(triageRows(card('a'), plain)).toEqual([]);
    const { container } = render(
      <TriageStrip item={card('a')} type={plain} canEdit onSet={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('reads a severity the card holds, and None for an unset priority', () => {
    render(
      <TriageStrip
        item={card('a', { 'f-sev': 'High' })}
        type={bug}
        canEdit={false}
        onSet={vi.fn()}
      />,
    );
    expect(document.querySelector('[data-triage-strip]')?.textContent).toBe(
      'PriorityNoneSeverityHigh',
    );
  });

  it('a row’s pill names the priority in its colour, or a dashed question mark', () => {
    render(
      <>
        <PriorityPill item={card('a', { priority: 'urgent' })} />
        <PriorityPill item={card('b', { priority: 'someday' })} />
      </>,
    );
    expect(document.querySelector('[data-priority-pill="urgent"]')?.textContent).toBe('Urgent');
    expect(document.querySelector('[data-priority-pill="none"]')?.textContent).toBe('?No priority');
  });
});

describe('the duplicate link', () => {
  const dup = card('z');
  it('links through a field holding one, never over another card, and takes it back', () => {
    expect(duplicateLink(card('a'), dup, [bug])).toEqual({
      field: 'f-dup',
      patch: { set: { 'f-dup': 'z' } },
    });
    expect(duplicateLink(card('a', { 'f-dup': 'z' }), dup, [bug])).toBeNull();
    expect(duplicateLink(card('a', { 'f-dup': 'y' }), dup, [bug])).toBeNull();
    expect(duplicateLink(card('a', {}, 'task'), dup, [bug])).toBeNull();
    expect(duplicateUnlink(card('a', { 'f-dup': 'z' }), 'f-dup', 'z', [bug])).toEqual({
      clear: ['f-dup'],
    });
    expect(duplicateUnlink(card('a', { 'f-dup': 'y' }), 'f-dup', 'z', [bug])).toBeNull();
    expect(duplicateUnlink(card('a'), 'f-gone', 'z', [bug])).toBeNull();
  });

  it('adds to a field holding several, and takes only its own card back out', () => {
    expect(duplicateLink(card('a', { 'f-dups': ['y'] }), dup, [several])).toEqual({
      field: 'f-dups',
      patch: { set: { 'f-dups': ['y', 'z'] } },
    });
    expect(duplicateUnlink(card('a', { 'f-dups': ['y', 'z'] }), 'f-dups', 'z', [several])).toEqual({
      set: { 'f-dups': ['y'] },
    });
  });
});

describe('a decision in words', () => {
  it('names a Close’s duplicate and reason, a deleted duplicate, and the latest decision', () => {
    const items = new Map([['z', card('z')]]);
    const d = { outcome: 'closed' as const, at: 1, by: 'S' };
    expect(decisionNote(d, items, [bug])).toBeNull();
    expect(decisionNote({ ...d, duplicateOf: 'z', reason: 'Same' }, items, [bug])).toBe(
      'Duplicate of BUG-122 · Same',
    );
    expect(decisionNote({ ...d, duplicateOf: 'gone' }, items, [bug])).toBe(
      'Duplicate of a deleted card',
    );
    expect(undoLabel('z', d, items, [bug])).toBe('Closed BUG-122');
  });
});

describe('CloseTray', () => {
  const items = new Map([
    ['a', card('a')],
    ['z', card('z')],
    ['y', card('y', { archived: true })],
  ]);
  const tray = (targetName: (dup: boolean) => string | null = () => null) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <CloseTray
        item={items.get('a')!}
        items={items}
        types={[bug]}
        targetName={targetName}
        statusName="New"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    return { onConfirm, onCancel };
  };
  const reason = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Reason' });

  it('says the card stays with no closing stage, and needs a reason before it closes', () => {
    const t = tray();
    expect(screen.getByText(/Stays in/).textContent).toBe('Stays in New: no closing stage');
    fireEvent.keyDown(reason(), { key: 'Enter' });
    fireEvent.keyDown(reason(), { key: 'a' });
    expect(t.onConfirm).not.toHaveBeenCalled();
    fireEvent.change(reason(), { target: { value: '  Works as designed ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close Bug' }));
    expect(t.onConfirm).toHaveBeenCalledWith({ reason: 'Works as designed' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(t.onCancel).toHaveBeenCalled();
  });

  it('a picked duplicate replaces the Duplicate chip’s word, offers only live other cards, and comes off again', () => {
    const t = tray((dup) => (dup ? 'Duplicate' : 'Won’t Fix'));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(reason().value).toBe('Duplicate');
    fireEvent.click(screen.getByRole('button', { name: 'Link Duplicate' }));
    const picker = screen.getByRole('dialog');
    expect(within(picker).queryByRole('button', { name: /Card Y/ })).toBeNull();
    expect(within(picker).queryByRole('button', { name: /Card A/ })).toBeNull();
    fireEvent.click(within(picker).getByRole('button', { name: /Card Z/ }));
    expect(reason().value).toBe('Duplicate of BUG-122');
    expect(screen.getByText(/Moves to/).textContent).toBe('Moves to Duplicate');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Duplicate' }));
    expect(screen.getByText(/Moves to/).textContent).toBe('Moves to Won’t Fix');
    // The picker closes without a pick, too.
    fireEvent.click(screen.getByRole('button', { name: 'Link Duplicate' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getAllByRole('button', { name: /Close/ })[0]!,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close Bug' }));
    expect(t.onConfirm).toHaveBeenCalledWith({ reason: 'Duplicate of BUG-122' });
  });
});
