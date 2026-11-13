// @vitest-environment jsdom
// docs/specs/007-editor/editor-app.md "Back closes a sheet that holds work": an open sheet has an entry in the
// browser's history, so Back closes the top sheet alone instead of leaving the page; a sheet closed another way steps
// back off its entry, and one Back left open takes its entry again.
import { act, cleanup, render } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBackCloses } from './useBackCloses';

const KEY = 'liveworkspaceSheets';
const tokens = () =>
  ((window.history.state as Record<string, unknown> | null)?.[KEY] ?? []) as string[];

// Back, as the browser does it: the entry under goes current, then popstate.
const back = () =>
  act(async () => {
    const popped = new Promise((resolve) =>
      window.addEventListener('popstate', resolve, { once: true }),
    );
    window.history.back();
    await popped;
  });

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

function Sheet({ onBack, active = true }: { onBack: () => void; active?: boolean }) {
  useBackCloses(active, onBack);
  return null;
}

afterEach(async () => {
  cleanup();
  await settle();
});

describe('useBackCloses', () => {
  it('takes an entry while open, keeping the state already there', () => {
    window.history.replaceState({ router: 'kept' }, '');
    render(<Sheet onBack={() => {}} />);
    expect(tokens()).toHaveLength(1);
    expect((window.history.state as Record<string, unknown>)['router']).toBe('kept');
  });

  it('takes no entry while inactive', () => {
    window.history.replaceState(null, '');
    render(<Sheet onBack={() => {}} active={false} />);
    expect(tokens()).toEqual([]);
  });

  it('calls the top sheet alone on Back, and takes its entry again so a kept sheet still has one', async () => {
    window.history.replaceState(null, '');
    const rule = vi.fn();
    const step = vi.fn();
    render(
      <>
        <Sheet onBack={rule} />
        <Sheet onBack={step} />
      </>,
    );
    expect(tokens()).toHaveLength(2);
    await back();
    expect(step).toHaveBeenCalledTimes(1);
    expect(rule).not.toHaveBeenCalled();
    // The step sheet asked something and stayed: its entry is back on top.
    expect(tokens()).toHaveLength(2);
  });

  it('steps back off its entry when closed another way', async () => {
    window.history.replaceState(null, '');
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <Sheet onBack={() => {}} active={open} />
          <button type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        </>
      );
    }
    const { getByRole } = render(<Host />);
    expect(tokens()).toHaveLength(1);
    const popped = new Promise((resolve) =>
      window.addEventListener('popstate', resolve, { once: true }),
    );
    act(() => getByRole('button').click());
    await act(async () => {
      await popped;
    });
    expect(tokens()).toEqual([]);
  });

  it('leaves history alone when the page went elsewhere while it was open', async () => {
    window.history.replaceState(null, '');
    const { unmount } = render(<Sheet onBack={() => {}} />);
    window.history.pushState({ page: 'elsewhere' }, '');
    const spy = vi.spyOn(window.history, 'go');
    unmount();
    await settle();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('keeps one entry through an effect run twice (StrictMode), and Back still reaches it', async () => {
    window.history.replaceState(null, '');
    const onBack = vi.fn();
    render(
      <StrictMode>
        <Sheet onBack={onBack} />
      </StrictMode>,
    );
    await settle();
    expect(tokens()).toHaveLength(1);
    await back();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('steps back off both entries when the rule and step sheets close together', async () => {
    window.history.replaceState(null, '');
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <Sheet onBack={() => {}} active={open} />
          <Sheet onBack={() => {}} active={open} />
          <button type="button" onClick={() => setOpen(false)}>
            Close Both
          </button>
        </>
      );
    }
    const { getByRole } = render(<Host />);
    expect(tokens()).toHaveLength(2);
    const popped = new Promise((resolve) =>
      window.addEventListener('popstate', resolve, { once: true }),
    );
    act(() => getByRole('button').click());
    await act(async () => {
      await popped;
    });
    expect(tokens()).toEqual([]);
  });

  it('names its sheets apart from the entries a reload left, so Back still closes the top sheet', async () => {
    // The page before the reload: a rule and a step sheet open, their entry on top.
    vi.resetModules();
    const before = (await import('./useBackCloses')).useBackCloses;
    window.history.replaceState(null, '');
    function Old() {
      before(true, () => {});
      return null;
    }
    const first = render(
      <>
        <Old />
        <Old />
      </>,
    );
    const left: unknown = window.history.state;
    first.unmount();
    await settle();
    // The reload: history keeps the entry, the module starts again.
    window.history.replaceState(left, '');
    vi.resetModules();
    const after = (await import('./useBackCloses')).useBackCloses;
    const rule = vi.fn();
    const step = vi.fn();
    function New({ onBack }: { onBack: () => void }) {
      after(true, onBack);
      return null;
    }
    render(
      <>
        <New onBack={rule} />
        <New onBack={step} />
      </>,
    );
    expect(tokens()).toHaveLength(4);
    await back();
    expect(step).toHaveBeenCalledTimes(1);
    expect(rule).not.toHaveBeenCalled();
  });
});
