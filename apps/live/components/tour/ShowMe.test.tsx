// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import type { TourStepOf } from './tour-step';
import { useTourEngine } from './useTourEngine';

vi.mock('./tour-dom', async (actual) => ({
  ...(await actual<typeof import('./tour-dom')>()),
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
}));
afterEach(cleanup);

const STEPS: TourStepOf<null>[] = [
  { id: 'one', title: 'First', body: 'The first step.', target: 'show-me-one' },
  { id: 'outro', card: 'outro', title: 'All Done', body: 'The end.' },
];

// docs/specs/007-editor/show-me.md: the button starts the tour once, straight on its first step, and the closing
// card links the surface's help article under its own label.
function Surface({
  onStart,
  onFinish,
}: {
  onStart: () => void | Promise<void>;
  onFinish: (o: string) => void;
}) {
  const apiRef = useRef(null);
  const tour = useTourEngine<null>({ steps: STEPS, apiRef, onStepView: () => {}, onFinish });
  return (
    <div>
      <ShowMeButton tour={tour} onStart={onStart} />
      <div data-tour-id="show-me-one">Target</div>
      <ShowMeStage tour={tour} article="sharing" />
    </div>
  );
}

const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)));

describe('Show Me', () => {
  it('starts on its first step when pressed, and a second press does nothing', async () => {
    const onStart = vi.fn();
    render(<Surface onStart={onStart} onFinish={() => {}} />);
    const button = screen.getByRole('button', { name: 'Show Me' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    await settle();
    expect(screen.getByRole('dialog', { name: /^Show Me step 1 of 1: First/ })).toBeTruthy();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('ends on a closing card linking the help article under its label', async () => {
    const onFinish = vi.fn();
    render(<Surface onStart={() => {}} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await settle();
    const link = screen.getByRole('link', { name: /Learn More/ });
    expect(link.getAttribute('href')).toBe('/help/collaboration/sharing/');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onFinish).toHaveBeenCalledWith('completed');
  });

  it('waits for steps loaded at the press before it starts', async () => {
    let loaded!: () => void;
    const onStart = () => new Promise<void>((resolve) => (loaded = resolve));
    render(<Surface onStart={onStart} onFinish={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    await settle();
    expect(screen.queryByRole('dialog', { name: /^Show Me step/ })).toBeNull();
    await act(async () => loaded());
    await settle();
    expect(screen.getByRole('dialog', { name: /^Show Me step 1 of 1: First/ })).toBeTruthy();
  });

  it('ignores a second press while its steps load, and can be pressed again after a failed load', async () => {
    let fail!: () => void;
    const onStart = vi.fn(
      () => new Promise<void>((_, reject) => (fail = () => reject(new Error('offline')))),
    );
    render(<Surface onStart={onStart} onFinish={() => {}} />);
    const button = screen.getByRole('button', { name: 'Show Me' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onStart).toHaveBeenCalledTimes(1);
    await act(async () => fail());
    await settle();
    expect(screen.queryByRole('dialog', { name: /^Show Me step/ })).toBeNull();
    fireEvent.click(button);
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});
