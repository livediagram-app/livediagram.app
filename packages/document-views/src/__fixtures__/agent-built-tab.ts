// The Services frame as an agent builds it through graph input, node ids its own slugs and arrow ids
// minted as slugs (docs/specs/024-agents/blueprints/document-views.md "Testing", VW7).
import { buildGraphTab, slugIdFor, type Element, type Tab } from '@livediagram/document';

function slugArrows(elements: readonly Element[]): Element[] {
  const taken = new Set(elements.filter((el) => el.type !== 'arrow').map((el) => el.id));
  return elements.map((el) => {
    if (el.type !== 'arrow') return el;
    const id = slugIdFor(el.label ?? '', 'arrow', taken);
    taken.add(id);
    return { ...el, id };
  });
}

export function agentBuiltTab(): Tab {
  const tab = buildGraphTab(
    'agent-tab',
    'Services',
    {
      nodes: [
        {
          id: 'orders',
          label: 'Orders service',
          note: 'Owns the order lifecycle and is the source of truth for order state.',
          group: 'services',
        },
        {
          id: 'event-bus',
          label: 'Event bus',
          shape: 'stadium',
          note: 'Kafka, 3 brokers, 7-day retention.',
          group: 'services',
        },
        { id: 'payments', label: 'Payments service', group: 'services' },
        { id: 'orders-db', label: 'Orders DB', shape: 'cylinder' },
        { id: 'inventory', label: 'Inventory service', group: 'services' },
        { id: 'notification', label: 'Notification worker', group: 'services' },
      ],
      edges: [
        { from: 'orders', to: 'payments', label: 'charge' },
        { from: 'orders', to: 'orders-db' },
        { from: 'orders', to: 'event-bus', label: 'OrderPlaced' },
        { from: 'event-bus', to: 'inventory' },
        { from: 'event-bus', to: 'notification' },
      ],
      groups: [{ id: 'services', label: 'Services' }],
    },
    undefined,
  );
  return { ...tab, elements: slugArrows(tab.elements) };
}
