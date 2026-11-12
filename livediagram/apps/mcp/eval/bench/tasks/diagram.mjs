// The diagram tasks of the benchmark (docs/instructions/evaluate-mcp-output.md): the bank every diagram product
// shares (@liveworkspace/mcp-kit/eval/diagram-tasks), judged with this product's checks.mjs, and livediagram's own
// Event Storming board (D12) in its place among them.
import { diagramTasks } from '@liveworkspace/mcp-kit/eval/diagram-tasks';
import * as checks from '../checks.mjs';

const { atLeast, find, shapes, tabsOf } = checks;

const D12 = {
  id: 'D12',
  level: 'medium',
  prompt:
    'Run an event storming session board for an online food delivery business: domain events from order placed to delivered, with commands, actors, policies and a couple of hotspots.',
  checks: [
    [
      'an Event Storming tab',
      ({ snap }) =>
        tabsOf(snap).some((t) => /event-storming/.test(t.outline?.split('\n')[0] ?? '')),
    ],
    [
      'domain events from order placed to delivered',
      ({ snap }) => ({
        pass:
          shapes(snap, 'sticky').filter((s) => s.esKind === 'domain-event').length >= 5 &&
          find(snap, /placed/i).length > 0 &&
          find(snap, /delivered/i).length > 0,
        detail: `${shapes(snap, 'sticky').filter((s) => s.esKind === 'domain-event').length} events`,
      }),
    ],
    [
      'commands, actors and policies',
      ({ snap }) => {
        const kinds = new Set(shapes(snap, 'sticky').map((s) => s.esKind));
        const missing = ['command', 'actor', 'policy'].filter((k) => !kinds.has(k));
        return {
          pass: missing.length === 0,
          detail: missing.length ? `no ${missing.join(', ')}` : null,
        };
      },
    ],
    [
      'a couple of hotspots',
      ({ snap }) =>
        atLeast(2, shapes(snap, 'sticky').filter((s) => s.esKind === 'hotspot').length, 'hotspots'),
    ],
  ],
};

const shared = diagramTasks(checks);
const at = shared.findIndex((t) => t.id === 'D13');

export default [...shared.slice(0, at), D12, ...shared.slice(at)];
