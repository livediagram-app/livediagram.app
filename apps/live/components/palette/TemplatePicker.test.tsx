// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

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

// Nor scrollTo / scrollIntoView, which the template shelf's carousel uses.
Element.prototype.scrollTo ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

const participant: Participant = { id: 'p1', name: 'Ada', color: '#0ea5e9', status: 'online' };

// docs/specs/007-editor/new-document-route.md "Start Blank": it lives on the outside surfaces that link
// to /new?blank=1; inside the wizard the footer's Skip commits the same blank defaults.
describe('TemplatePicker, the welcome wizard', () => {
  it('has no Start Blank or Just Draw button of its own', () => {
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={vi.fn()}
        onSkip={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /just draw/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^start blank$/i })).toBeNull();
  });
});
