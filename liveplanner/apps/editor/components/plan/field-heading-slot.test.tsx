// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemDetailsRow, ItemPanelSection } from './ItemPanelLayout';
import { RichTextField } from './RichTextField';

// docs/specs/026-plan/plan-board.md "Main column" (Work Tracker 1513): where there is no hover, a rich text field's Edit
// sits on its heading line's end, the text taking the full width below; its in-text copy gives way there. Hosts with
// no heading line keep the in-text button, the text clear of it.
vi.mock('@/components/notes/NoteRichTextEditor', () => ({
  NoteRichTextEditor: (p: { label: string }) => <textarea aria-label={p.label} />,
}));
afterEach(cleanup);

const field = (onEdit = vi.fn()) => (
  <RichTextField
    runs={[{ text: 'Why we ship this' }]}
    canEdit
    label="Description"
    addPrompt="Add a description…"
    emptyText="No description"
    placeholder="Write…"
    onSave={onEdit}
  />
);
const edits = () => screen.getAllByRole('button', { name: 'Edit the description' });

describe('a rich text field’s Edit', () => {
  it('sits on a section heading’s line where there is no hover, the in-text one hidden there', () => {
    const { container } = render(
      <ItemPanelSection heading="Description">{field()}</ItemPanelSection>,
    );
    const slot = container.querySelector('[data-field-heading-slot="touch"]')!;
    expect(slot.className).toContain('max-sm:flex');
    expect(slot.className).toContain('[@media(hover:none)]:flex');
    const [onLine, inText] = edits();
    expect(slot.contains(onLine!)).toBe(true);
    expect(onLine!.className).toContain('touch-target');
    expect(inText!.className).toContain('max-sm:hidden');
    expect(inText!.className).toContain('[@media(hover:none)]:hidden');
    // The text keeps no column for the button.
    expect(inText!.parentElement!.className).not.toContain('pr-16');
  });

  it('opens the editor from the heading line', () => {
    render(<ItemPanelSection heading="Description">{field()}</ItemPanelSection>);
    fireEvent.click(edits()[0]!);
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit the description' })).toBeNull();
  });

  it('sits beside a Details row’s label on a phone alone', () => {
    const { container } = render(<ItemDetailsRow label="Description">{field()}</ItemDetailsRow>);
    const slot = container.querySelector('[data-field-heading-slot="phone"]')!;
    expect(slot.className).toContain('max-sm:flex');
    expect(slot.className).not.toContain('hover:none');
    const [onLine, inText] = edits();
    expect(slot.contains(onLine!)).toBe(true);
    expect(inText!.className).toContain('max-sm:hidden');
    // A wider touch screen keeps the in-text button, the text clear of it.
    expect(inText!.className).toContain('[@media(hover:none)]:opacity-100');
    expect(inText!.parentElement!.className).toContain('sm:[@media(hover:none)]:pr-16');
  });

  it('stays in the text’s corner with no heading line', () => {
    render(field());
    const [only] = edits();
    expect(edits()).toHaveLength(1);
    expect(only!.className).toContain('max-sm:opacity-100');
    expect(only!.parentElement!.className).toContain('max-sm:pr-16');
  });

  it('keeps a heading with no field action as it was, an empty slot at its end', () => {
    const { container } = render(
      <ItemPanelSection heading="Due" htmlFor="due">
        <input id="due" />
      </ItemPanelSection>,
    );
    expect(screen.getByLabelText('Due')).toBeTruthy();
    expect(container.querySelector('[data-field-heading-slot]')!.childElementCount).toBe(0);
  });
});
