// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import type { Participant } from '@/lib/identity';
import { setIllustrateModeEnabled } from '@/lib/offered-editor-modes';
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

  // The browser opens where its selection is (docs/specs/006-document/save-locations.md): the
  // checked radio names the folder the document goes to, never a space card that only holds it.
  const checkedRadios = () =>
    within(screen.getByRole('radiogroup', { name: 'Choose livediagram Folder' }))
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
  const nested = [
    { id: 'p', name: 'Projects', parentId: null },
    { id: 'w', name: 'Workshops', parentId: 'p' },
  ];

  it('shows the pre-selected default as the checked radio, at its parent level', () => {
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={vi.fn()}
        onSkip={vi.fn()}
        onBackOut={vi.fn()}
        defaults={defaults}
        folders={nested}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    const checked = checkedRadios();
    expect(checked).toHaveLength(1);
    expect(checked[0]!.textContent).toMatch(/^Workshops/);
    expect(screen.getByRole('button', { name: /My documents/ }).textContent).toContain('Projects');
  });

  it('shows a /new?folder= context as the checked radio the same way', () => {
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={vi.fn()}
        onSkip={vi.fn()}
        onBackOut={vi.fn()}
        initialPlacement="folder:w"
        folders={nested}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(checkedRadios().map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^Workshops/),
    ]);
  });

  it('offers Always save for another folder, and carries it when ticked', () => {
    const onPick = renderWithDefaults();
    fireEvent.click(screen.getByRole('radio', { name: /My documents/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Elsewhere/ }));
    const box = screen.getByRole('switch', { name: 'Always save diagrams here' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onPick.mock.calls[0]![3]).toMatchObject({
      folderId: 'x',
      alwaysSave: { key: 'mode:diagram', folderId: 'x' },
    });
  });
});

// docs/specs/007-editor/new-document-route.md "`/new?mode=<mode>` and `/new?q=<words>`".
describe('TemplatePicker, the /new presets', () => {
  const renderPreset = (preset: { initialModeChoice?: 'illustrate'; initialQuery?: string }) => {
    const onPick = vi.fn();
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={onPick}
        onSkip={vi.fn()}
        onBackOut={vi.fn()}
        {...preset}
      />,
    );
    return onPick;
  };

  it('opens a `q` preset on its matches at once, with no debounce to wait out', () => {
    renderPreset({ initialQuery: 'town hall' });
    expect(
      (screen.getByRole('searchbox', { name: 'Search templates' }) as HTMLInputElement).value,
    ).toBe('town hall');
    expect(screen.queryByRole('heading', { name: /^Popular/ })).toBeNull();
  });

  it('ignores a mode that is switched off, selecting the plain blank', () => {
    setIllustrateModeEnabled(false);
    try {
      const onPick = renderPreset({ initialModeChoice: 'illustrate' });
      fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
      expect(onPick.mock.calls[0]![0]).toBe('blank');
    } finally {
      setIllustrateModeEnabled(true);
    }
  });
});
