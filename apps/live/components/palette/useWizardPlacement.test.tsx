// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TemplateKind } from '@livediagram/templates';
import { useWizardPlacement, type WizardDefaults } from './useWizardPlacement';

// The wizard's placement (docs/specs/013-workspace/default-folders.md "The New Document wizard").

const defaults = (opts: { whiteboards?: string } = {}): WizardDefaults => ({
  resolve: (kind) => ({
    found:
      kind === 'whiteboard' && opts.whiteboards
        ? { key: 'mode:draw', value: `folder:${opts.whiteboards}`, folderName: 'Workshops' }
        : null,
    skipped: [],
  }),
  alwaysSaveKey: (kind) => (kind === 'whiteboard' ? 'mode:draw' : 'mode:diagram'),
  currentValue: (key) =>
    key === 'mode:draw' && opts.whiteboards ? `folder:${opts.whiteboards}` : 'unsorted',
  change: async () => true,
});

const render = (context: string | undefined, kind: TemplateKind, d?: WizardDefaults) =>
  renderHook((props) => useWizardPlacement(props), {
    initialProps: { context, kind, defaults: d },
  });

describe('useWizardPlacement', () => {
  it('pre-selects the default at the My documents root, and sends it explicitly', () => {
    const { result } = render(undefined, 'whiteboard', defaults({ whiteboards: 'w' }));
    expect(result.current.selected).toBe('folder:w');
    expect(result.current.source).toBe('default');
    expect(result.current.shownDefault?.folderName).toBe('Workshops');
    expect(result.current.sent()).toEqual({ teamId: null, folderId: 'w' });
  });

  it('lets a folder or team context win', () => {
    const { result } = render('team:t:folder:f', 'whiteboard', defaults({ whiteboards: 'w' }));
    expect(result.current.selected).toBe('team:t:folder:f');
    expect(result.current.shownDefault).toBeNull();
    expect(result.current.sent()).toEqual({ teamId: 't', folderId: 'f' });
  });

  it('sends nothing for a root it only showed', () => {
    const { result } = render(undefined, 'blank', defaults());
    expect(result.current.selected).toBe('unsorted');
    expect(result.current.sent()).toEqual({});
  });

  it('sends the explicit root when the reader picks it on purpose', () => {
    const { result } = render(undefined, 'whiteboard', defaults({ whiteboards: 'w' }));
    act(() => result.current.pick('unsorted'));
    expect(result.current.source).toBe('picked');
    expect(result.current.sent()).toEqual({ teamId: null, folderId: null });
  });

  it('re-resolves when the template changes, unless the reader picked', () => {
    const d = defaults({ whiteboards: 'w' });
    const hook = render(undefined, 'blank', d);
    expect(hook.result.current.selected).toBe('unsorted');
    hook.rerender({ context: undefined, kind: 'whiteboard', defaults: d });
    expect(hook.result.current.selected).toBe('folder:w');
    act(() => hook.result.current.pick('folder:other'));
    hook.rerender({ context: undefined, kind: 'blank', defaults: d });
    expect(hook.result.current.selected).toBe('folder:other');
  });

  it('offers Always save only away from where those documents go, unticked', () => {
    const { result } = render(undefined, 'whiteboard', defaults({ whiteboards: 'w' }));
    expect(result.current.offer).toBeNull();
    act(() => result.current.pick('folder:x'));
    expect(result.current.offer).toEqual({ key: 'mode:draw', folderId: 'x' });
    expect(result.current.alwaysSave).toBeNull();
    act(() => result.current.setAlwaysSave(true));
    expect(result.current.alwaysSave).toEqual({ key: 'mode:draw', folderId: 'x' });
    act(() => result.current.pick('unsorted'));
    expect(result.current.offer).toEqual({ key: 'mode:draw', folderId: null });
    expect(result.current.alwaysSave).toBeNull();
  });

  it('never offers a team root', () => {
    const { result } = render('team:t', 'whiteboard', defaults());
    expect(result.current.offer).toBeNull();
  });
});
