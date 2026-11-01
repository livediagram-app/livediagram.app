// @vitest-environment jsdom
// The Component menu section, Make Component and the In This Design band (docs/specs/009-elements/components.md),
// and the share roles on each: only an Editor makes, places, overrides, detaches or edits.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  libraryLookup,
  type DesignComponent,
  type Element,
  type InstanceElement,
} from '@livedesign/design';

const editor = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
vi.mock('@/app/design/[id]/EditorContext', () => ({
  useEditorContext: () => editor.value,
  useOptionalEditorContext: () => editor.value,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// The colour picker reads the editor's theme; its trigger is what is under test here.
vi.mock('@/components/colour/ColourSwatchButton', () => ({
  ColourSwatchButton: ({ label, onPick }: { label: string; onPick: (id: string) => void }) => (
    <button type="button" aria-label={label} onClick={() => onPick('#ff0000')} />
  ),
}));

import { ComponentMenuSection, MakeComponentRow } from './ComponentMenuSection';
import { DesignComponentsBand } from './component-tiles';

afterEach(() => {
  cleanup();
  editor.value = null;
});

const main: DesignComponent = {
  id: 'm',
  name: 'Header',
  width: 100,
  height: 40,
  elements: [
    {
      id: 'title',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      label: 'Acme',
    },
    { id: 'logo', type: 'shape', shape: 'icon', iconId: 'star', x: 0, y: 0, width: 10, height: 10 },
  ] as Element[],
  updatedAt: 1,
};

const instance = (over: Partial<InstanceElement> = {}): InstanceElement => ({
  id: 'i',
  type: 'shape',
  shape: 'instance',
  componentId: 'm',
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  ...over,
});

const sectionProps = () => ({ open: true, onToggle: () => {}, flush: false });

function withEditor(canEdit: boolean, mains: DesignComponent[] = [main], loaded = true) {
  const lib = new Map(mains.map((m) => [m.id, m]));
  const actions = {
    canEdit,
    makeRefusal: vi.fn(() => null as string | null),
    makeFromSelection: vi.fn(),
    placeInstance: vi.fn(),
    detach: vi.fn(),
    setOverride: vi.fn(),
    resetOverrides: vi.fn(),
    rename: vi.fn(),
    removeFromLibrary: vi.fn(),
    startEdit: vi.fn(),
    finishEdit: vi.fn(),
  };
  editor.value = {
    componentActions: actions,
    componentLibrary: { library: lib, lookup: libraryLookup(lib), loaded },
    activeTab: { id: 't', name: 'T', elements: [] },
  };
  return actions;
}

describe('ComponentMenuSection on an instance', () => {
  it("gives an Editor the main's name, Edit, Detach, Reset, Remove and the overrides", async () => {
    const a = withEditor(true);
    const onClose = vi.fn();
    render(
      <ComponentMenuSection
        target={instance({ componentOverrides: { title: { label: 'Globex' } } })}
        sectionProps={sectionProps}
        onClose={onClose}
      />,
    );
    const name = screen.getByDisplayValue('Header');
    fireEvent.change(name, { target: { value: 'Nav' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(a.rename).toHaveBeenCalledWith('m', 'Nav');
    fireEvent.click(screen.getByText('Edit Component'));
    expect(a.startEdit).toHaveBeenCalledWith('i');
    fireEvent.click(screen.getByText('Detach'));
    expect(a.detach).toHaveBeenCalledWith('i');
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Reset Overrides'));
    expect(a.resetOverrides).toHaveBeenCalledWith('i');
    fireEvent.click(screen.getByText('Remove from Library'));
    expect(a.removeFromLibrary).toHaveBeenCalledWith('m');

    // The overridden text shows, and a change back to the main's clears it.
    const text = screen.getByDisplayValue('Globex');
    fireEvent.change(text, { target: { value: 'Acme' } });
    fireEvent.blur(text);
    expect(a.setOverride).toHaveBeenLastCalledWith('i', 'title', 'label', undefined);
    fireEvent.change(text, { target: { value: 'Initech' } });
    fireEvent.keyDown(text, { key: 'Enter' });
    expect(a.setOverride).toHaveBeenLastCalledWith('i', 'title', 'label', 'Initech');
    fireEvent.change(text, { target: { value: 'nothing' } });
    fireEvent.keyDown(text, { key: 'Escape' });
    expect(screen.getByDisplayValue('Globex')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Acme fill colour'));
    expect(a.setOverride).toHaveBeenLastCalledWith('i', 'title', 'fillColor', '#ff0000');
    fireEvent.click(screen.getByLabelText('Reset Acme'));
    expect(a.setOverride).toHaveBeenLastCalledWith('i', 'title', 'label', undefined);

    // Icon swap: a search, then a pick.
    fireEvent.change(screen.getByLabelText('Swap Icon icon'), { target: { value: 'heart' } });
    const pick = (await screen.findAllByRole('button', { name: /^Use / }))[0]!;
    fireEvent.click(pick);
    expect(a.setOverride).toHaveBeenLastCalledWith('i', 'logo', 'iconId', expect.any(String));
  });

  it('gives a locked instance its name only, and a removed main no Remove', () => {
    withEditor(true, [{ ...main, archived: true }]);
    render(
      <ComponentMenuSection
        target={instance({ locked: true })}
        sectionProps={sectionProps}
        onClose={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('Header')).toBeTruthy();
    expect(screen.queryByText('Edit Component')).toBeNull();
    cleanup();
    withEditor(true, [{ ...main, archived: true }]);
    render(
      <ComponentMenuSection target={instance()} sectionProps={sectionProps} onClose={() => {}} />,
    );
    expect(screen.queryByText('Remove from Library')).toBeNull();
  });

  it('gives a Participant or Viewer nothing to change', () => {
    withEditor(false);
    render(
      <ComponentMenuSection target={instance()} sectionProps={sectionProps} onClose={() => {}} />,
    );
    expect(screen.getByText('Header')).toBeTruthy();
    expect(screen.queryByDisplayValue('Header')).toBeNull();
    expect(screen.queryByText('Detach')).toBeNull();
    expect(screen.queryByText('Overrides')).toBeNull();
  });

  it('says Loading, then Missing, for an instance with no main', () => {
    withEditor(true, [], false);
    render(
      <ComponentMenuSection target={instance()} sectionProps={sectionProps} onClose={() => {}} />,
    );
    expect(screen.getByText('Loading component')).toBeTruthy();
    cleanup();
    withEditor(true, [], true);
    render(
      <ComponentMenuSection target={instance()} sectionProps={sectionProps} onClose={() => {}} />,
    );
    expect(screen.getByText('Missing component')).toBeTruthy();
  });
});

describe('Make Component', () => {
  it('makes from an element for an Editor, and is absent for anyone else', () => {
    const a = withEditor(true);
    const onClose = vi.fn();
    const el = { id: 'x', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 };
    render(
      <ComponentMenuSection target={el as Element} sectionProps={sectionProps} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Make Component'));
    expect(a.makeFromSelection).toHaveBeenCalledWith(new Set(['x']));
    expect(onClose).toHaveBeenCalled();
    cleanup();
    withEditor(false);
    const { container } = render(
      <ComponentMenuSection target={el as Element} sectionProps={sectionProps} onClose={onClose} />,
    );
    expect(container.textContent).toBe('');
    cleanup();
    withEditor(false);
    expect(
      render(<MakeComponentRow ids={new Set(['x'])} onDone={() => {}} />).container.textContent,
    ).toBe('');
  });

  it('is greyed with its reason when the selection cannot be made', () => {
    const a = withEditor(true);
    a.makeRefusal.mockReturnValue('locked');
    render(<MakeComponentRow ids={new Set(['x'])} onDone={() => {}} />);
    fireEvent.click(screen.getByText('Make Component'));
    expect(a.makeFromSelection).not.toHaveBeenCalled();
  });
});

describe('In This Design', () => {
  it("shows the design's mains to an Editor and places one on a click", () => {
    const a = withEditor(true, [main, { ...main, id: 'gone', name: 'Old', archived: true }]);
    render(<DesignComponentsBand />);
    expect(screen.getByText('In This Design')).toBeTruthy();
    expect(screen.queryByText('Old')).toBeNull();
    fireEvent.click(screen.getByText('Header'));
    expect(a.placeInstance).toHaveBeenCalledWith('m');
  });

  it('says how to make one while empty, and is absent for a non-Editor or outside the editor', () => {
    withEditor(true, []);
    render(<DesignComponentsBand />);
    expect(screen.getByText(/choose Make Component/)).toBeTruthy();
    cleanup();
    withEditor(false);
    expect(render(<DesignComponentsBand />).container.textContent).toBe('');
    cleanup();
    editor.value = null;
    expect(render(<DesignComponentsBand />).container.textContent).toBe('');
  });
});
