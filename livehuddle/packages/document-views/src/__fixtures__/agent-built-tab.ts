// A services map as an agent builds it, node ids its own slugs and arrow ids minted as slugs
// (docs/specs/024-agents/blueprints/document-views.md "Testing", VW7). No group: the graph input that drew groups as
// boundaries is gone (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3).
import {
  createShape,
  slugIdFor,
  type Element,
  type ShapeKind,
  type Tab,
} from '@livehuddle/document';
import { createPinnedArrow } from './build';

function slugArrows(elements: readonly Element[]): Element[] {
  const taken = new Set(elements.filter((el) => el.type !== 'arrow').map((el) => el.id));
  return elements.map((el) => {
    if (el.type !== 'arrow') return el;
    const id = slugIdFor(el.label ?? '', 'arrow', taken);
    taken.add(id);
    return { ...el, id };
  });
}

const node = (
  id: string,
  label: string,
  [x, y]: [number, number],
  extra: { shape?: ShapeKind; note?: string } = {},
): Element => ({
  ...createShape(extra.shape ?? 'square', x, y),
  id,
  label,
  x,
  y,
  width: 180,
  height: 64,
  ...(extra.note ? { note: extra.note } : {}),
});

const edge = (from: string, to: string, label?: string): Element => ({
  ...createPinnedArrow(from, 'e', to, 'w'),
  id: `${from}-${to}`,
  ...(label ? { label } : {}),
});

export function agentBuiltTab(): Tab {
  const elements: Element[] = [
    node('orders', 'Orders service', [0, 120], {
      note: 'Owns the order lifecycle and is the source of truth for order state.',
    }),
    node('event-bus', 'Event bus', [280, 240], {
      shape: 'stadium',
      note: 'Kafka, 3 brokers, 7-day retention.',
    }),
    node('payments', 'Payments service', [280, 0]),
    node('orders-db', 'Orders DB', [280, 120], { shape: 'cylinder' }),
    node('inventory', 'Inventory service', [560, 180]),
    node('notification', 'Notification worker', [560, 300]),
    edge('orders', 'payments', 'charge'),
    edge('orders', 'orders-db'),
    edge('orders', 'event-bus', 'OrderPlaced'),
    edge('event-bus', 'inventory'),
    edge('event-bus', 'notification'),
  ];
  return { id: 'agent-tab', name: 'Services', elements: slugArrows(elements) };
}
