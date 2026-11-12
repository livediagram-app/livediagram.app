// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The rule builder": an edit made while Save Rule is on its way is kept, Test on
// a Card tries the rule as it would save (this browser's time zone), and a test left for Another Card never lands
// over the picker.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuleBuilder } from './RuleBuilder';
import { NOW, outline, rule, run } from './test-fixtures';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const api = { save: vi.fn(), toggle: vi.fn(), test: vi.fn() };
function Builder({ saved = rule() }: { saved?: ReturnType<typeof rule> }) {
  return (
    <RuleBuilder
      rule={saved}
      initial={saved}
      outline={outline()}
      api={api}
      person="Ana Costa"
      now={NOW}
      phone={false}
      onBack={() => {}}
      onSaved={() => {}}
      onDirty={() => {}}
      timeZone="Europe/London"
      scope={{ projectId: 'p1', shareCode: null }}
    />
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const nameBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Rule name' });
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /Save Rule|Saving/ });

describe('the rule builder', () => {
  it('keeps an edit made while the save is on its way', async () => {
    const answer = deferred<ReturnType<typeof rule>>();
    api.save.mockReturnValueOnce(answer.promise);
    render(<Builder />);
    fireEvent.change(nameBox(), { target: { value: 'Wrapped' } });
    fireEvent.click(saveButton());
    expect(api.save).toHaveBeenCalledWith('r1', expect.objectContaining({ name: 'Wrapped' }));
    // Typed on while it saves.
    fireEvent.change(nameBox(), { target: { value: 'Wrapped Up Twice' } });
    await act(async () => answer.resolve(rule({ name: 'Wrapped' })));
    expect(nameBox().value).toBe('Wrapped Up Twice');
    // Still unsaved, so Save Rule stays on.
    expect(saveButton().disabled).toBe(false);
  });

  it('takes the saved rule when nothing changed while it saved', async () => {
    api.save.mockResolvedValueOnce(rule({ name: 'Wrapped' }));
    render(<Builder />);
    fireEvent.change(nameBox(), { target: { value: 'wrapped ' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(nameBox().value).toBe('Wrapped'));
    expect(saveButton().disabled).toBe(true);
  });

  it('tests the rule in this browser’s time zone, as Save Rule would save it', async () => {
    api.test.mockResolvedValueOnce({ run: run() });
    render(<Builder saved={rule({ timeZone: 'UTC' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test on a Card' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publish pricing page/ }));
    await waitFor(() =>
      expect(api.test).toHaveBeenCalledWith(
        expect.objectContaining({ timeZone: 'Europe/London' }),
        'i48',
      ),
    );
  });

  it('drops a test’s answer once Another Card is picked', async () => {
    const answer = deferred<{ run: ReturnType<typeof run> }>();
    api.test.mockReturnValueOnce(answer.promise);
    render(<Builder />);
    fireEvent.click(screen.getByRole('button', { name: 'Test on a Card' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publish pricing page/ }));
    expect(await screen.findByText('Trying the rule on this card…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Another Card' }));
    await act(async () => answer.resolve({ run: run() }));
    // Still picking: the first card's answer never lands.
    expect(screen.getByRole('button', { name: /Publish pricing page/ })).toBeTruthy();
    expect(screen.queryByText('Removed the label blocked')).toBeNull();
  });
});
