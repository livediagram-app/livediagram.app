// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  entityFieldView,
  entityHeaderHeight,
  type EntityField,
  type FieldRemap,
  type ShapeElement,
} from '@livedesign/document';
import { getEntityFieldEdit, setEntityFieldEdit } from '@/lib/entity-field-edit';
import { EntityView } from './EntityView';
import { EntityFieldControls } from './EntityFieldControls';
import { openEntityFieldAt } from './entity-double-click';

// docs/specs/009-elements/entity.md "Editing on the canvas" and "Field to field".

const entity = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('entity', 0, 0),
  id: 'e1',
  height: 200,
  entityFields: [
    { name: 'id', type: 'uuid', key: 'pk' },
    { name: 'email', type: 'text' },
  ],
  ...over,
});

const actions = () => ({ setFields: vi.fn(), startFieldArrow: vi.fn() });

// The controls as the view mounts them on a selected entity, its fields read through entityFieldView.
const Controls = ({ element, a }: { element: ShapeElement; a: ReturnType<typeof actions> }) => (
  <EntityFieldControls
    element={element}
    fields={(element.entityFields ?? []).map(entityFieldView)}
    actions={a}
  />
);

afterEach(() => act(() => setEntityFieldEdit(null)));

describe('EntityView', () => {
  it('draws the key glyph and a semibold primary key, and is inert without actions', () => {
    const { container } = render(
      <EntityView element={entity()} textColor="#000" fontFamily={undefined} />,
    );
    expect(screen.getByText('id').className).toContain('font-semibold');
    expect(screen.getByText('email').className).not.toContain('font-semibold');
    expect(container.querySelectorAll('svg path').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-entity-field-controls]')).toBeNull();
  });

  it('reads a legacy key from the type text', () => {
    render(
      <EntityView
        element={entity({ entityFields: [{ name: 'id', type: 'uuid PK' }] })}
        textColor="#000"
        fontFamily={undefined}
      />,
    );
    expect(screen.getByText('uuid')).toBeTruthy();
    expect(screen.getByText('id').className).toContain('font-semibold');
  });
});

describe('the view with actions', () => {
  it('loads its controls and opens a field', async () => {
    act(() => setEntityFieldEdit({ entityId: 'e1', index: 0 }));
    render(
      <EntityView element={entity()} textColor="#000" fontFamily={undefined} actions={actions()} />,
    );
    expect((await screen.findByLabelText<HTMLInputElement>('Field name')).value).toBe('id');
  });
});

describe('in-place editing', () => {
  it('saves a renamed field and moves to the next on Enter', () => {
    const a = actions();
    render(<Controls element={entity()} a={a} />);
    act(() => setEntityFieldEdit({ entityId: 'e1', index: 1 }));
    const name = screen.getByLabelText('Field name') as HTMLInputElement;
    expect(name.value).toBe('email');
    fireEvent.change(name, { target: { value: 'mail' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(a.setFields).toHaveBeenCalledWith('e1', [
      { name: 'id', type: 'uuid', key: 'pk' },
      { name: 'mail', type: 'text' },
    ]);
    expect(getEntityFieldEdit()).toEqual({ entityId: 'e1', index: 2 });
  });

  it('adds a new field after the last only once it has words, and cycles its key', () => {
    const a = actions();
    render(<Controls element={entity()} a={a} />);
    act(() => setEntityFieldEdit({ entityId: 'e1', index: 2 }));
    const name = screen.getByLabelText('Field name');
    fireEvent.click(screen.getByRole('button', { name: /Key: None/ }));
    fireEvent.click(screen.getByRole('button', { name: /Key: PK/ }));
    fireEvent.change(name, { target: { value: 'org_id' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'uuid' } });
    fireEvent.keyDown(screen.getByLabelText('Field type'), { key: 'Tab' });
    expect(a.setFields).toHaveBeenCalledWith('e1', [
      { name: 'id', type: 'uuid', key: 'pk' },
      { name: 'email', type: 'text' },
      { name: 'org_id', type: 'uuid', key: 'fk' },
    ]);
  });

  // Escape keeps what was typed, as on every canvas label (docs/specs/008-canvas/canvas-and-palette.md "Labels").
  it('writes nothing for a blank new field, and keeps a change on Escape', () => {
    const a = actions();
    render(<Controls element={entity()} a={a} />);
    act(() => setEntityFieldEdit({ entityId: 'e1', index: 2 }));
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    expect(a.setFields).not.toHaveBeenCalled();
    expect(getEntityFieldEdit()).toBeNull();
    act(() => setEntityFieldEdit({ entityId: 'e1', index: 0 }));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'changed' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Escape' });
    expect(a.setFields).toHaveBeenCalledOnce();
    expect((a.setFields.mock.calls[0] as [string, EntityField[]])[1][0]!.name).toBe('changed');
    expect(getEntityFieldEdit()).toBeNull();
  });

  it('removes a field emptied of name and type, letting go of ends on it', () => {
    const a = actions();
    render(<Controls element={entity()} a={a} />);
    act(() => setEntityFieldEdit({ entityId: 'e1', index: 0 }));
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: '' } });
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Enter' });
    const [, fields, remap] = a.setFields.mock.calls[0] as [string, EntityField[], FieldRemap];
    expect(fields).toEqual([{ name: 'email', type: 'text' }]);
    expect(remap(0)).toBeNull();
    expect(remap(1)).toBe(0);
    expect(getEntityFieldEdit()).toEqual({ entityId: 'e1', index: 0 });
  });

  it('steps back with Shift+Tab on the name', () => {
    render(<Controls element={entity()} a={actions()} />);
    act(() => setEntityFieldEdit({ entityId: 'e1', index: 1 }));
    fireEvent.keyDown(screen.getByLabelText('Field name'), { key: 'Tab', shiftKey: true });
    expect(getEntityFieldEdit()).toEqual({ entityId: 'e1', index: 0 });
  });

  it('ends an open edit when the entity is deselected', () => {
    const { unmount } = render(<Controls element={entity()} a={actions()} />);
    act(() => setEntityFieldEdit({ entityId: 'e1', index: 0 }));
    unmount();
    expect(getEntityFieldEdit()).toBeNull();
  });
});

describe('openEntityFieldAt', () => {
  const rect = (height: number) => ({ top: 100, height }) as DOMRect;
  it('opens the field under the pointer, a new one below the last, and leaves the title alone', () => {
    const el = entity();
    const header = entityHeaderHeight(el.textSize);
    expect(openEntityFieldAt(el, rect(200), 100 + header + 6 + 16.75 + 4)).toBe(true);
    expect(getEntityFieldEdit()).toEqual({ entityId: 'e1', index: 1 });
    expect(openEntityFieldAt(el, rect(200), 290)).toBe(true);
    expect(getEntityFieldEdit()).toEqual({ entityId: 'e1', index: 2 });
    expect(openEntityFieldAt(el, rect(200), 105)).toBe(false);
    // At half zoom the same field is half as far down the screen.
    expect(openEntityFieldAt(el, rect(100), 100 + (header + 6 + 4) / 2)).toBe(true);
    expect(getEntityFieldEdit()).toEqual({ entityId: 'e1', index: 0 });
  });
});

describe('field ports', () => {
  it('shows a port each side of the hovered field and starts a relationship from it', () => {
    const a = actions();
    const { container } = render(<Controls element={entity()} a={a} />);
    const layer = container.querySelector('[data-entity-field-controls]') as HTMLElement;
    const header = entityHeaderHeight(entity().textSize);
    layer.getBoundingClientRect = () => ({ top: 0, height: 200 - header }) as DOMRect;
    fireEvent.pointerMove(layer, { clientY: 6 + 4 });
    const ports = screen.getAllByRole('button', { name: 'Draw a relationship from id' });
    expect(ports).toHaveLength(2);
    fireEvent.pointerDown(container.querySelector('[data-entity-port="e"]')!);
    expect(a.startFieldArrow).toHaveBeenCalledWith('e1', 'e', 0, expect.anything());
    fireEvent.pointerLeave(layer);
    expect(screen.queryAllByRole('button', { name: /Draw a relationship/ })).toHaveLength(0);
  });
});
