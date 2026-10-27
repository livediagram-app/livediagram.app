// @vitest-environment jsdom

// The top chrome's mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): a compact dropdown chip right
// of the menu button, on every general tab an Editor may switch, empty or not; its name dropped on a phone. A
// Participant, a Viewer, a locked tab and an event-storming board get none (share roles: changing a tab's mode is an
// Editor's). The menu itself is covered in StartModeSwitch.menu.test.tsx and ModeMenu.test.tsx.

import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@livediagram/api-schema';
import { EDITOR_MODES, editorModeLabel, type EditorMode, type Tab } from '@livediagram/document';
import { useEditorMode, type EditorModeState } from '@/hooks/editor/useEditorMode';
import { useViewPreview } from '@/app/document/[id]/useViewPreview';
import { EditorModeProvider } from './editor-mode-context';
import { EditorModeSwitch } from './EditorModeSwitch';
import { TabModeIcon } from './TabModeIcon';
import { StartModeSwitch } from '@/components/start/StartModeSwitch';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/view-transition', () => ({
  startTypedTransition: (_type: string, change: () => void) => change(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSwitch(
  mode: EditorMode,
  over: Partial<EditorModeState> = {},
  props: { iconOnly?: boolean } = {},
) {
  const setMode = vi.fn<(mode: EditorMode) => void>();
  const view = render(
    <EditorModeProvider value={{ mode, setMode, canSwitch: true, canEdit: true, ...over }}>
      <EditorModeSwitch {...props} />
    </EditorModeProvider>,
  );
  return { setMode, ...view };
}

const slot = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-editor-mode-switch]');
const chip = () => screen.getByRole('button', { name: /^Editor mode:/ });

describe('EditorModeSwitch chip', () => {
  it.each(EDITOR_MODES)('is a collapsed menu button named after %s', (mode) => {
    renderSwitch(mode);
    expect(chip().getAttribute('aria-label')).toBe(`Editor mode: ${editorModeLabel(mode)}`);
    expect(chip().getAttribute('aria-haspopup')).toBe('menu');
    expect(chip().getAttribute('aria-expanded')).toBe('false');
    expect(chip().getAttribute('aria-keyshortcuts')).toBe('Shift+D');
  });

  it('shows the mode as its icon and name on a computer', () => {
    renderSwitch('workshop');
    expect(chip().textContent).toBe('Workshop');
    expect(chip().querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('shows the icon alone on a phone, keeping its accessible name', () => {
    renderSwitch('draw', {}, { iconOnly: true });
    expect(chip().textContent).toBe('');
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Draw');
    expect(chip().querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('is a toolbar-height chip, its menu not stretched across a phone', () => {
    renderSwitch('diagram');
    expect(chip().className).toMatch(/\bh-9\b/);
    fireEvent.click(chip());
    expect(screen.getByRole('menu').className).not.toMatch(/max-sm:inset-x-2/);
  });

  it('switches from its menu and closes', () => {
    const { setMode } = renderSwitch('draw');
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Diagram/ }));
    expect(setMode).toHaveBeenCalledWith('diagram');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('EditorModeSwitch slot', () => {
  it.each([false, true])('keeps one width across the modes (iconOnly %s)', (iconOnly) => {
    const widths = new Set<string>();
    for (const mode of EDITOR_MODES) {
      widths.add(slot(renderSwitch(mode, {}, { iconOnly }).container)!.className);
      cleanup();
    }
    expect(widths.size).toBe(1);
  });

  it('is narrower on a phone', () => {
    const named = slot(renderSwitch('diagram').container)!.className;
    cleanup();
    const iconOnly = slot(renderSwitch('diagram', {}, { iconOnly: true }).container)!.className;
    expect(iconOnly).not.toBe(named);
    expect(iconOnly).toMatch(/\bw-12\b/);
  });

  it('renders nothing outside an editor', () => {
    const { container } = render(<EditorModeSwitch />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing where the tab offers no switch (locked, event storming)', () => {
    expect(slot(renderSwitch('diagram', { canSwitch: false }).container)).toBeNull();
  });
});

// The switch as the editor drives it: the session role through useViewPreview's one `canEdit`, the tab through
// useEditorMode, a switch committing onto the tab.
describe('EditorModeSwitch in the editor, by share role', () => {
  let seq = 0;
  const tabWith = (over: Partial<Tab> = {}): Tab => {
    seq += 1;
    return { id: `ems${seq}`, name: 'Tab', elements: [], ...over };
  };
  const drawnOn = (over: Partial<Tab> = {}) =>
    tabWith({
      elements: [
        {
          id: 'f1',
          type: 'freehand',
          x: 0,
          y: 0,
          width: 40,
          height: 20,
          points: [
            [0, 0],
            [40, 20],
          ],
        } as unknown as Tab['elements'][number],
      ],
      ...over,
    });

  function Host({ tab: initial, role }: { tab: Tab; role: AccessLevel }) {
    const [tabs, setTabs] = useState([initial]);
    const { canEdit } = useViewPreview(role, () => {});
    const editorMode = useEditorMode(tabs[0], {
      canEdit,
      commitTabs: (map) => setTabs((ts) => map(ts)),
      toastInfo: () => {},
    });
    return (
      <EditorModeProvider value={editorMode}>
        <EditorModeSwitch />
        <output data-tab-mode={tabs[0]!.opensIn ?? 'diagram'} />
      </EditorModeProvider>
    );
  }

  it('lets an Editor switch a tab with content, losslessly', () => {
    const tab = drawnOn({ opensIn: 'draw' });
    const { container } = render(<Host tab={tab} role="edit" />);
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Draw');
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Diagram/ }));
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Diagram');
    expect(container.querySelector('[data-tab-mode]')?.getAttribute('data-tab-mode')).toBe(
      'diagram',
    );
  });

  it('lets an Editor switch an empty tab too', () => {
    render(<Host tab={tabWith()} role="edit" />);
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Workshop/ }));
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Workshop');
  });

  it.each(['participate', 'view'] as const)('offers a %s session no switch', (role) => {
    const { container } = render(<Host tab={drawnOn()} role={role} />);
    expect(slot(container)).toBeNull();
    expect(screen.queryByRole('button', { name: /mode:/ })).toBeNull();
  });

  it('offers no switch on a locked tab, nor on an event-storming board', () => {
    const locked = render(<Host tab={drawnOn({ locked: true })} role="edit" />);
    expect(slot(locked.container)).toBeNull();
    cleanup();
    const es = render(<Host tab={tabWith({ kind: 'event-storming' })} role="edit" />);
    expect(slot(es.container)).toBeNull();
  });
});

// docs/specs/007-editor/editor-modes.md "The two always agree": on an empty tab the chip beside the menu button and the
// start's switch show at once, over the one source of truth (Tab.opensIn), so a switch in either updates the other and
// the tab pill's icon.
describe('EditorModeSwitch and the start switch on an empty tab', () => {
  const iconHtml = (mode: EditorMode) => {
    const { container, unmount } = render(<TabModeIcon tab={{ id: 'ref', opensIn: mode }} />);
    const html = container.innerHTML;
    unmount();
    return html;
  };

  function Both({ initial }: { initial: Tab }) {
    const [tabs, setTabs] = useState([initial]);
    const editorMode = useEditorMode(tabs[0], {
      canEdit: true,
      commitTabs: (map) => setTabs((ts) => map(ts)),
      toastInfo: () => {},
    });
    return (
      <EditorModeProvider value={editorMode}>
        <EditorModeSwitch />
        <StartModeSwitch />
        <span data-pill-icon="">
          <TabModeIcon tab={tabs[0]!} />
        </span>
      </EditorModeProvider>
    );
  }

  const startChip = () => screen.getByRole('button', { name: /^Tab mode:/ });
  const pillIcon = () => document.querySelector('[data-pill-icon]')!.innerHTML;

  it('shows both, agreeing, and a switch in either moves the other and the tab icon', () => {
    const draw = iconHtml('draw');
    const workshop = iconHtml('workshop');
    render(<Both initial={{ id: 'empty1', name: 'Tab', elements: [] }} />);
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Diagram');
    expect(startChip().getAttribute('aria-label')).toBe('Tab mode: Diagram');

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Draw/ }));
    expect(startChip().getAttribute('aria-label')).toBe('Tab mode: Draw');
    expect(pillIcon()).toBe(draw);

    fireEvent.click(startChip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Workshop/ }));
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Workshop');
    expect(pillIcon()).toBe(workshop);
  });
});
