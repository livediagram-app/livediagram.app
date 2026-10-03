// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
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

// docs/specs/007-editor/new-document-route.md "Escape backs out".
describe('TemplatePicker, Escape', () => {
  const renderWelcome = () => {
    const onPick = vi.fn();
    const onSkip = vi.fn();
    const onBackOut = vi.fn();
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={onPick}
        onSkip={onSkip}
        onBackOut={onBackOut}
      />,
    );
    return { onPick, onSkip, onBackOut };
  };

  it('backs out of the wizard from the Template step, creating nothing', () => {
    const { onPick, onSkip, onBackOut } = renderWelcome();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBackOut).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('steps back from Location to Template first', () => {
    const { onBackOut } = renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(screen.getByText(/Location/)).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBackOut).not.toHaveBeenCalled();
    expect(screen.getByRole('searchbox', { name: 'Search templates' })).toBeTruthy();
  });

  it('clears a search first', () => {
    const { onBackOut } = renderWelcome();
    const search = screen.getByRole('searchbox', { name: 'Search templates' });
    fireEvent.change(search, { target: { value: 'kanban' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(onBackOut).not.toHaveBeenCalled();
  });

  it('backs out with the X too, from any step, creating nothing', () => {
    const { onPick, onSkip, onBackOut } = renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onBackOut).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('keeps closing as before without a back-out (Quick Start over the canvas)', () => {
    const onSkip = vi.fn();
    render(
      <TemplatePicker
        mode="templates"
        participant={participant}
        currentThemeId="brand"
        onPick={vi.fn()}
        onSkip={onSkip}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/013-workspace/default-folders.md "Precedence": the wizard sends the placement the person
// saw or picked (the Location step's root tile included) and none when the picker never showed, so
// only an unseen placement leaves room for a default folder.
describe('TemplatePicker, placement seen or not', () => {
  const renderWelcome = (initialPlacement?: string) => {
    const onPick = vi.fn();
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={onPick}
        onSkip={vi.fn()}
        onBackOut={vi.fn()}
        {...(initialPlacement ? { initialPlacement } : {})}
      />,
    );
    return onPick;
  };
  const settingsOf = (onPick: ReturnType<typeof vi.fn>) => onPick.mock.calls[0]![3] as object;

  it('sends no placement when Skip commits before the Location step showed', () => {
    const onPick = renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(settingsOf(onPick)).not.toHaveProperty('folderId');
    expect(settingsOf(onPick)).not.toHaveProperty('teamId');
  });

  it('sends no placement for the root it only showed', () => {
    const onPick = renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(settingsOf(onPick)).not.toHaveProperty('folderId');
  });

  it('sends the root chosen on purpose', () => {
    const onPick = renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    fireEvent.click(screen.getByRole('radio', { name: /My documents/ }));
    fireEvent.click(screen.getByRole('radio', { name: /My documents/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(settingsOf(onPick)).toMatchObject({ teamId: null, folderId: null });
  });

  it('sends a placement seeded from the /new URL, even on Skip', () => {
    const onPick = renderWelcome('folder:f1');
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(settingsOf(onPick)).toMatchObject({ teamId: null, folderId: 'f1' });
  });
});

// docs/specs/013-workspace/default-folders.md "The New Document wizard": the Location step
// pre-selects the template's default folder, says why, and offers Always save elsewhere.
describe('TemplatePicker, default folders', () => {
  const defaults = {
    resolve: () => ({
      found: { key: 'mode:diagram' as const, value: 'folder:w', folderName: 'Workshops' },
      skipped: [],
    }),
    alwaysSaveKey: () => 'mode:diagram' as const,
    currentValue: () => 'folder:w',
    change: vi.fn(async () => true),
  };
  const renderWithDefaults = () => {
    const onPick = vi.fn();
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={onPick}
        onSkip={vi.fn()}
        onBackOut={vi.fn()}
        defaults={defaults}
        folders={[
          { id: 'w', name: 'Workshops', parentId: null },
          { id: 'x', name: 'Elsewhere', parentId: null },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    return onPick;
  };

  it('pre-selects the default, says why, and sends it explicitly', () => {
    const onPick = renderWithDefaults();
    expect(screen.getByRole('note').textContent).toBe(
      'Diagrams go to Workshops by default. Change default',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onPick.mock.calls[0]![3]).toMatchObject({ teamId: null, folderId: 'w' });
  });

  it('offers Always save for another folder, and carries it when ticked', () => {
    const onPick = renderWithDefaults();
    fireEvent.click(screen.getByRole('radio', { name: /My documents/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Elsewhere/ }));
    const box = screen.getByRole('checkbox', { name: 'Always save diagrams here' });
    expect((box as HTMLInputElement).checked).toBe(false);
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onPick.mock.calls[0]![3]).toMatchObject({
      folderId: 'x',
      alwaysSave: { key: 'mode:diagram', folderId: 'x' },
    });
  });
});
