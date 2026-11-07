// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ArcadeScore, type ShapeElement } from '@livehuddle/document';
import { ConfirmProvider } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { ArcadeMenuSection, arcadeClearQuestion, arcadeCountLine } from './ArcadeMenuSection';

// docs/specs/009-elements/social-pieces.md "High Scores", "Clearing": an Editor's Clear High Scores, asked first.

const score = (id: string): ArcadeScore => ({
  id,
  name: 'Ann',
  score: 10,
  ms: 5000,
  by: 'k',
  at: 1,
});
const machine = (n: number): ShapeElement => ({
  ...createShape('arcade-machine', 0, 0),
  id: 'arc',
  ...(n > 0 ? { arcadeScores: Array.from({ length: n }, (_, i) => score(`s${i}`)) } : {}),
});
const open = () => ({ open: true, onToggle: () => {} });

function renderSection(n: number, onClear = vi.fn()) {
  render(
    <ConfirmProvider>
      <ArcadeMenuSection target={machine(n)} sectionProps={open} onClear={onClear} />
    </ConfirmProvider>,
  );
  return onClear;
}
const clearButton = () => screen.getByRole('button', { name: 'Clear High Scores' });

afterEach(cleanup);

describe('ArcadeMenuSection', () => {
  it('reads the count, and its questions match the table', () => {
    expect(arcadeCountLine(0)).toBe('No Scores Yet');
    expect(arcadeCountLine(1)).toBe('1 Score on the table');
    expect(arcadeCountLine(10)).toBe('10 Scores on the table');
    expect(arcadeClearQuestion(1)).toBe('Clear 1 score?');
    expect(arcadeClearQuestion(3)).toBe('Clear all 3 scores?');
  });

  it('is off while the table is empty', () => {
    renderSection(0);
    expect(screen.getByText('No Scores Yet')).toBeTruthy();
    expect((clearButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks first, and clears only once confirmed', async () => {
    const onClear = renderSection(3);
    expect(screen.getByText('3 Scores on the table')).toBeTruthy();
    fireEvent.click(clearButton());
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.getByRole('dialog'));
    expect(dialog.textContent).toContain('Clear all 3 scores?');
    expect(dialog.textContent).toContain("This can't be undone.");
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Clear all 3 scores?')).toBeNull());
    expect(onClear).not.toHaveBeenCalled();

    fireEvent.click(clearButton());
    await screen.findByText('Clear all 3 scores?');
    // The dialog's own Clear High Scores, the last of the two.
    const buttons = screen.getAllByRole('button', { name: 'Clear High Scores' });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1));
  });
});
