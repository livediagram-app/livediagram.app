import { Glyph } from '@livediagram/ui';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The BPMN tiles (docs/specs/009-elements/bpmn.md "The palette"): each places an existing kind carrying its BPMN mark
// (a shape variant, packages/document bpmn.ts), or arms the arrow tool in a BPMN line look. One group, BPMN, at the
// end of Diagram mode's Shapes (palette-layouts.ts); no category or toolbar button of its own. Their descriptions
// carry what people search for them by.

const BPMN_SEARCH = 'BPMN 2.0, business process, Camunda, bpmn.io.';

export const BPMN_TILES: PaletteTileDef[] = [
  {
    id: 'bpmn:start-event',
    section: 'bpmn',
    label: 'Add BPMN Start Event',
    caption: 'Start',
    blurb: 'Where a process begins',
    description: `BPMN start event. A thin circle where the process begins. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'circle', variant: 'bpmn-start' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="12" r="8" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:intermediate-event',
    section: 'bpmn',
    label: 'Add BPMN Intermediate Event',
    caption: 'Intermediate',
    blurb: 'Something that happens on the way',
    description: `BPMN intermediate event. A double circle: a message, timer or error met along the way. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'circle', variant: 'bpmn-intermediate' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="6" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:end-event',
    section: 'bpmn',
    label: 'Add BPMN End Event',
    caption: 'End',
    blurb: 'Where a process ends',
    description: `BPMN end event. A heavy circle where the process ends. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'circle', variant: 'bpmn-end' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="12" cy="12" r="7.5" strokeWidth={3.5} />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:task',
    section: 'bpmn',
    label: 'Add BPMN Task',
    caption: 'Task',
    blurb: 'One piece of work',
    description: `BPMN task. A rounded box for one piece of work; change its type to user, service, script or manual. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'square', variant: 'bpmn-task' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="6" width="18" height="12" rx="3" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:user-task',
    section: 'bpmn',
    label: 'Add BPMN User Task',
    caption: 'User Task',
    blurb: 'Work a person does',
    description: `BPMN user task. A task a person does, with the user marker. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'square', variant: 'bpmn-user-task' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <circle cx="8" cy="9.6" r="1.4" />
        <path d="M5.6 13.6c0-1.4 1.1-2.2 2.4-2.2s2.4.8 2.4 2.2" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:subprocess',
    section: 'bpmn',
    label: 'Add BPMN Sub-Process',
    caption: 'Sub-Process',
    blurb: 'A process folded into one step',
    description: `BPMN collapsed sub-process. A task with a plus box: a whole process folded into one step. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'square', variant: 'bpmn-subprocess' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <rect x="9.5" y="13" width="5" height="5" rx="0.5" />
        <path d="M12 14v3M10.5 15.5h3" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:exclusive-gateway',
    section: 'bpmn',
    label: 'Add BPMN Exclusive Gateway',
    caption: 'Exclusive',
    blurb: 'Exactly one path is taken',
    description: `BPMN exclusive gateway (XOR). A diamond with an X: exactly one outgoing path is taken. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'diamond', variant: 'bpmn-exclusive' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
        <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:parallel-gateway',
    section: 'bpmn',
    label: 'Add BPMN Parallel Gateway',
    caption: 'Parallel',
    blurb: 'Every path, at the same time',
    description: `BPMN parallel gateway (AND). A diamond with a plus: every path runs, and a join waits for all. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'diamond', variant: 'bpmn-parallel' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
        <path d="M12 8v8M8 12h8" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:inclusive-gateway',
    section: 'bpmn',
    label: 'Add BPMN Inclusive Gateway',
    caption: 'Inclusive',
    blurb: 'One or more paths are taken',
    description: `BPMN inclusive gateway (OR). A diamond with a circle: one or more paths are taken. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'diamond', variant: 'bpmn-inclusive' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
        <circle cx="12" cy="12" r="3.6" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:data-object',
    section: 'bpmn',
    label: 'Add BPMN Data Object',
    caption: 'Data Object',
    blurb: 'Information a step reads or writes',
    description: `BPMN data object. A page with a folded corner: information a step reads or writes. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'document', variant: 'bpmn-data-object' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d="M6 3h8.5L19 7.5V21H6Z" />
        <path d="M14.5 3v4.5H19" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:data-store',
    section: 'bpmn',
    label: 'Add BPMN Data Store',
    caption: 'Data Store',
    blurb: 'Where data is kept',
    description: `BPMN data store. A cylinder: a database or system the process keeps data in. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'cylinder', variant: 'bpmn-data-store' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <ellipse cx="12" cy="6" rx="7" ry="2.5" />
        <path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:pool',
    section: 'bpmn',
    label: 'Add BPMN Pool',
    caption: 'Pool',
    blurb: 'A participant, with lanes inside',
    description: `BPMN pool or lane. A band titled down its left edge for a participant or a role; nest them for lanes. Swimlane. ${BPMN_SEARCH}`,
    filled: true,
    action: { type: 'shape', kind: 'lane', variant: 'bpmn-pool' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <rect x="2.5" y="5" width="19" height="14" rx="1" />
        <path d="M6.5 5v14M6.5 12h15" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:message-flow',
    section: 'bpmn',
    label: 'Add BPMN Message Flow',
    caption: 'Message Flow',
    blurb: 'A message between participants',
    description: `BPMN message flow. A dashed line from an open circle to an open arrowhead, between pools. ${BPMN_SEARCH}`,
    action: { type: 'arrow', flow: 'message' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <circle cx="4.5" cy="12" r="2" />
        <path d="M6.5 12h2.5M11.5 12h2.5" />
        <path d="M16.5 8.5 21 12l-4.5 3.5Z" />
      </Glyph>
    ),
  },
  {
    id: 'bpmn:association',
    section: 'bpmn',
    label: 'Add BPMN Association',
    caption: 'Association',
    blurb: 'Ties data or a note to a step',
    description: `BPMN association. A dotted line tying a data object, a data store or a note to a step. ${BPMN_SEARCH}`,
    action: { type: 'arrow', flow: 'association' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24} strokeLinecap="round">
        <path d="M3 12h.01M7 12h.01M11 12h.01M15 12h.01M19 12h.01M21 12h.01" />
      </Glyph>
    ),
  },
];
