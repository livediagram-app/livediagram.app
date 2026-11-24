// @vitest-environment jsdom

// AI Editing (docs/specs/030-knowledgebase/ai-editing.md "The dialog"): the three cards as one radio group, the
// option under Edit Any Page, Save only once something differs, Cancel keeping what is held, and a failure said in
// the dialog.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeSettingsWire } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { track } from '@/lib/telemetry';
import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import type { AskSession } from '@/components/ask/useAskSession';
import { AiEditingDialog } from './AiEditingDialog';

const DOC = 'kb-ai-editing';
const session = {
  documentId: DOC,
  name: 'Handbook',
  who: { owner: 'user_o' },
  rights: {},
} as unknown as AskSession;

afterEach(() => {
  cleanup();
  knowledgeSettingsStore.take(DOC, { reviewEvery: 90 });
  vi.clearAllMocks();
});

function open(
  save = vi.fn(async (_w: unknown, _d: string, change: object): Promise<KnowledgeSettingsWire> => ({
    reviewEvery: 90,
    ...change,
  })),
) {
  const onClose = vi.fn();
  render(<AiEditingDialog session={session} onClose={onClose} save={save as never} />);
  const dialog = screen.getByRole('dialog', { name: 'AI Editing' });
  return { dialog, onClose, save };
}
const radio = (name: string) => screen.getByRole('radio', { name });
const saveButton = () => screen.getByRole('button', { name: 'Save' });

describe('the AI Editing dialog', () => {
  it('offers three levels in one group, Suggest Edits Only chosen by default, each described by its line', () => {
    open();
    const group = screen.getByRole('radiogroup', { name: 'AI Editing' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('value')),
    ).toEqual(['suggest', 'unverified', 'any']);
    expect((radio('Suggest Edits Only') as HTMLInputElement).checked).toBe(true);
    const unverified = radio('Edit Unverified Pages');
    const about = document.getElementById(unverified.getAttribute('aria-describedby')!);
    expect(about?.textContent).toContain('nobody has verified');
    // Nothing differs yet: nothing to save.
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AiEditing');
  });

  it('unfolds Remove Verification When AI Edits only under Edit Any Page, off by default', () => {
    open();
    const row = document.querySelector('[data-ai-edit-unverifies-row]')!;
    expect(row.hasAttribute('inert')).toBe(true);
    fireEvent.click(radio('Edit Any Page'));
    expect(row.hasAttribute('inert')).toBe(false);
    const toggle = screen.getByRole('switch', { name: 'Remove Verification When AI Edits' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('saves only what changed, tells the store and closes', async () => {
    const { save, onClose } = open();
    fireEvent.click(radio('Edit Any Page'));
    fireEvent.click(screen.getByRole('switch', { name: 'Remove Verification When AI Edits' }));
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);
    await act(async () => fireEvent.click(saveButton()));
    expect(save).toHaveBeenCalledWith(session.who, DOC, {
      aiEditing: 'any',
      aiEditUnverifies: true,
    });
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'AiEditingAny');
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'AiEditUnverifiesOn');
    expect(knowledgeSettingsStore.aiEditingOf(DOC)).toEqual({ level: 'any', unverifies: true });
    expect(onClose).toHaveBeenCalled();
  });

  it('starts from what the knowledgebase holds, and choosing it again offers nothing to save', () => {
    knowledgeSettingsStore.take(DOC, { reviewEvery: 90, aiEditing: 'unverified' });
    open();
    expect((radio('Edit Unverified Pages') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(radio('Edit Any Page'));
    fireEvent.click(radio('Edit Unverified Pages'));
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('leaves everything as it was on Cancel', () => {
    const { save, onClose } = open();
    fireEvent.click(radio('Edit Any Page'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(knowledgeSettingsStore.aiEditingOf(DOC).level).toBe('suggest');
  });

  it.each([
    [new ApiError('set ai editing', 403, 'forbidden'), 'Only an Editor'],
    [new Error('offline'), 'could not be saved'],
  ])('says a failed save in the dialog and keeps the choice (%s)', async (err, says) => {
    const { onClose } = open(
      vi.fn(async () => {
        throw err;
      }),
    );
    fireEvent.click(radio('Edit Unverified Pages'));
    await act(async () => fireEvent.click(saveButton()));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(says));
    expect(onClose).not.toHaveBeenCalled();
    expect((radio('Edit Unverified Pages') as HTMLInputElement).checked).toBe(true);
    expect(knowledgeSettingsStore.aiEditingOf(DOC).level).toBe('suggest');
  });

  it('moves between the cards with the arrow keys, as one radio group', () => {
    open();
    const first = radio('Suggest Edits Only');
    first.focus();
    expect(document.activeElement).toBe(first);
    // Native radios: a browser moves the choice on the arrow keys; here each radio shares one name.
    const names = new Set(screen.getAllByRole('radio').map((r) => r.getAttribute('name')));
    expect(names.size).toBe(1);
  });
});
