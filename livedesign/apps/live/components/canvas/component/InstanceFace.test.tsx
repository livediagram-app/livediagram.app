// @vitest-environment jsdom
// An instance on the canvas (docs/specs/009-elements/components.md "How an instance draws"), and the edit session's
// bar ("Editing the main").

import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  libraryLookup,
  type DesignComponent,
  type Element,
  type ShapeElement,
} from '@livedesign/design';
import { InstanceFace } from './InstanceFace';
import { ComponentFaceContext, type ComponentFaceContextValue } from './component-face-context';
import { ComponentSessionBar } from './ComponentSessionBar';
import { useComponentSession } from '@/app/design/[id]/useComponentSession';

afterEach(cleanup);

const main: DesignComponent = {
  id: 'm',
  name: 'Header',
  width: 100,
  height: 40,
  elements: [
    { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 40, label: 'Acme' },
  ] as Element[],
  updatedAt: 1,
};

const instance: ShapeElement = {
  id: 'i',
  type: 'shape',
  shape: 'instance',
  componentId: 'm',
  x: 0,
  y: 0,
  width: 200,
  height: 80,
  componentOverrides: { a: { label: 'Globex' } },
};

function face(ctx: ComponentFaceContextValue | null, el: ShapeElement = instance) {
  return render(
    <ComponentFaceContext.Provider value={ctx}>
      <InstanceFace element={el} surface="light" />
    </ComponentFaceContext.Provider>,
  );
}

const ctx = (mains: DesignComponent[], loaded = true): ComponentFaceContextValue => ({
  lookup: libraryLookup(new Map(mains.map((m) => [m.id, m]))),
  loaded,
  tab: {},
  paper: '#ffffff',
});

describe('InstanceFace', () => {
  it('draws its main in its box, overrides applied', () => {
    const { container } = face(ctx([main]));
    const svg = container.querySelector('[data-instance-face="drawn"]')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 80');
    expect(svg.innerHTML).toContain('Globex');
    expect(svg.innerHTML).not.toContain('Acme');
  });

  it('says Loading until the library answers, then Missing', () => {
    face(ctx([], false));
    expect(screen.getByText('Loading component')).toBeTruthy();
    cleanup();
    face(null);
    expect(screen.getByText('Loading component')).toBeTruthy();
    cleanup();
    face(ctx([]));
    expect(screen.getByText('Missing component')).toBeTruthy();
    cleanup();
    face(ctx([main]), { ...instance, componentId: undefined });
    expect(screen.getByText('Missing component')).toBeTruthy();
  });
});

describe('ComponentSessionBar', () => {
  it('names the main and finishes on Done, or on Escape with nothing selected', () => {
    const onDone = vi.fn();
    let empty = false;
    render(<ComponentSessionBar name="Header" nothingSelected={() => empty} onDone={onDone} />);
    expect(screen.getByText('Header')).toBeTruthy();
    fireEvent.click(screen.getByText('Done'));
    expect(onDone).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDone).toHaveBeenCalledTimes(1);
    empty = true;
    fireEvent.keyDown(window, { key: 'a' });
    expect(onDone).toHaveBeenCalledTimes(1);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onDone).toHaveBeenCalledTimes(1);
    input.remove();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDone).toHaveBeenCalledTimes(2);
  });
});

describe('useComponentSession', () => {
  const lib = new Map([[main.id, main]]);
  const session = (els: Element[], canEdit = true, selfId = 'me') => {
    const changeComponent = vi.fn();
    const { result } = renderHook(() =>
      useComponentSession({
        canEdit,
        selfId,
        elements: els,
        library: { lookup: libraryLookup(lib), changeComponent },
      }),
    );
    return { result, changeComponent };
  };
  const open = { ...instance, width: 100, height: 40, componentEditBy: 'me' } as Element;
  const member = (label: string) =>
    ({
      ...main.elements[0]!,
      id: 'i-a',
      label,
      componentMember: { instanceId: 'i', elementId: 'a' },
    }) as Element;

  it("derives the main from this person's session as its members change", () => {
    const s = session([open, member('Edited')]);
    expect(s.result.current.sessionInstanceId).toBe('i');
    expect(s.changeComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [expect.objectContaining({ id: 'a', label: 'Edited' })],
      }),
    );
  });

  it("leaves an unchanged main, another person's session, and a non-Editor alone", () => {
    expect(session([open, member('Acme')]).changeComponent).not.toHaveBeenCalled();
    const other = session([open, member('X')], true, 'someone-else');
    expect(other.result.current.sessionInstanceId).toBeNull();
    expect(other.changeComponent).not.toHaveBeenCalled();
    expect(session([open, member('X')], false).changeComponent).not.toHaveBeenCalled();
    const missing = { ...open, componentId: 'gone' } as Element;
    expect(session([missing, member('X')]).changeComponent).not.toHaveBeenCalled();
  });
});
