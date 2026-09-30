// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import type { Participant } from '@/lib/identity';
import { TemplatePicker } from './TemplatePicker';

// jsdom has no ResizeObserver; the height-animated boxes only need one to exist.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const participant: Participant = { id: 'p1', name: 'Ada', color: '#0ea5e9', status: 'online' };

// docs/specs/007-editor/new-document-route.md "Start Blank": the wizard's step rail carries it.
describe('TemplatePicker step rail', () => {
  it('offers Start Blank, which commits the blank defaults and keeps its JustDraw token', () => {
    const onPick = vi.fn();
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={onPick}
        onSkip={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /just draw/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^start blank$/i }));
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'JustDraw');
    expect(onPick).toHaveBeenCalledWith('blank', expect.any(String), 'brand', expect.any(Object));
  });
});
