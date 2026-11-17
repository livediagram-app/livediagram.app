// The diagram tasks of the benchmark (docs/instructions/evaluate-mcp-output.md): the bank every diagram product
// shares (@liveworkspace/mcp-kit/eval/diagram-tasks), judged with this product's checks.mjs, and livediagram's own
// Event Storming board (D12) in its place among them and its C4 model (D17) after them.
import { diagramTasks } from '@liveworkspace/mcp-kit/eval/diagram-tasks';
import * as checks from '../checks.mjs';

const { atLeast, elementsOf, find, lc, shapes, tabsOf } = checks;

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

// The C4 model's look (docs/specs/015-api/mcp-server.md §4.7 `c4`): a C4 element is a card or a cylinder in C4's
// fills, a level's system or container a C4-style boundary.
const C4_FILLS = { person: '#08427b', container: '#2f78c4', component: '#85bbf0' };
const tabsWith = (snap, test) => tabsOf(snap).filter((t) => t.elements.some(test));
const c4Fill = (fill) => (e) => e.type === 'shape' && lc(e.fillColor) === fill;
const c4Boundary = (e) => e.type === 'shape' && e.shape === 'boundary' && e.boundaryStyle === 'c4';

const D17 = {
  id: 'D17',
  level: 'hard',
  prompt:
    'Draw the C4 model of an internet banking system: its System Context, its Containers, and the Components of its API application, each level on its own tab.',
  checks: [
    ['three tabs, one per level', ({ snap }) => atLeast(3, tabsOf(snap).length, 'tabs')],
    [
      'people and containers in the C4 colours',
      ({ snap }) => ({
        pass:
          tabsWith(snap, c4Fill(C4_FILLS.person)).length > 0 &&
          tabsWith(snap, c4Fill(C4_FILLS.container)).length > 0,
        detail: null,
      }),
    ],
    [
      'the API application opened into components',
      ({ snap }) =>
        atLeast(3, elementsOf(snap).filter(c4Fill(C4_FILLS.component)).length, 'components'),
    ],
    [
      'the system and the container drawn as C4 boundaries',
      ({ snap }) => atLeast(2, elementsOf(snap).filter(c4Boundary).length, 'C4 boundaries'),
    ],
  ],
};

const shared = diagramTasks(checks);
const at = shared.findIndex((t) => t.id === 'D13');

export default [...shared.slice(0, at), D12, ...shared.slice(at), D17];
