// Fixtures for the components tests (docs/specs/009-elements/components.md): a small nav bar main and an instance.
import type { ArrowElement } from './arrow-types';
import type { DesignComponent, InstanceElement } from './components';
import type { Element, ShapeElement, TextElement } from './index';

export function box(id: string, x: number, y: number, w = 40, h = 20, extra = {}): ShapeElement {
  return { id, type: 'shape', shape: 'square', x, y, width: w, height: h, ...extra };
}

export function text(id: string, x: number, y: number, label: string): TextElement {
  return { id, type: 'text', x, y, width: 60, height: 20, label };
}

export function arrow(
  id: string,
  from: ArrowElement['from'],
  to: ArrowElement['to'],
): ArrowElement {
  return { id, type: 'arrow', from, to };
}

/** A 200 x 40 nav bar: a bar, a brand label and an icon. */
export function navMain(extra: Partial<DesignComponent> = {}): DesignComponent {
  const elements: Element[] = [
    box('bar', 0, 0, 200, 40, { fillColor: '#111111', colorPreset: 'bold' }),
    { ...text('brand', 10, 10, 'Acme'), textSwatch: 2 },
    box('icon', 170, 10, 20, 20, { shape: 'icon', iconId: 'home' }),
  ];
  return { id: 'cmp1', name: 'Nav', width: 200, height: 40, elements, updatedAt: 1, ...extra };
}

export function instanceOf(
  main: DesignComponent,
  extra: Partial<InstanceElement> = {},
): InstanceElement {
  return {
    id: 'inst',
    type: 'shape',
    shape: 'instance',
    componentId: main.id,
    x: 100,
    y: 50,
    width: main.width,
    height: main.height,
    ...extra,
  };
}
