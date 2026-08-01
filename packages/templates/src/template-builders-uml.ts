// Formal UML templates: the class diagram and the state machine. Both
// lean on UML notation the arrow model already ships (spec/09): hollow
// triangle heads for inheritance, hollow diamonds for aggregation, and
// event-labelled transitions. They share a file because they share
// that notation vocabulary; the looser architecture sketches live in
// template-builders-technical.ts.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so each template is
// self-describing. See spec/09 "Templates" for the catalogue.

import {
  createPinnedArrow,
  createShape,
  type Element,
  type EntityField,
} from '@livediagram/diagram';

// A small media-library class model: an abstract MediaItem with Song /
// Podcast subclasses and a Playlist aggregating items.
//
// Each class is one ENTITY element (spec/120) — a title bar over member
// rows. It used to be two flush-stacked tables sharing a groupId, where the
// SEAM between them stood in for the attribute / method separator: three
// objects pretending to be one class, and members that could only be edited
// as table cells rather than as members.
//
// The separator goes with it, which is the honest trade. UML's three
// compartments were never the point of this template; a class you can add a
// member to from its own menu is worth more than a rule drawn by an accident
// of stacking. Methods keep their `()` so they still read as methods, and
// attributes keep their types in the type column where they belong.
//
// Members use UML visibility markers (- private, + public).
export function buildUmlClass(cx: number, cy: number): Element[] {
  const classW = 270;
  const rowH = 26;
  // The entity's title band (spec/120) at the default text size.
  const TITLE_H = 30;

  type UmlClass = {
    name: string;
    centerX: number;
    topY: number;
    attributes: string[];
    methods: string[];
  };

  const topRowY = cy - 280;
  const bottomRowY = cy + 90;
  const classes: UmlClass[] = [
    {
      name: 'MediaItem',
      centerX: cx + 110,
      topY: topRowY,
      attributes: ['- title: string', '- duration: int'],
      methods: ['+ play()', '+ pause()'],
    },
    {
      name: 'Playlist',
      centerX: cx - 350,
      topY: topRowY,
      attributes: ['- name: string', '- items: MediaItem[]'],
      methods: ['+ add(item)', '+ shuffle()'],
    },
    {
      name: 'Song',
      centerX: cx - 110,
      topY: bottomRowY,
      attributes: ['- artist: string', '- album: string'],
      methods: ['+ play()'],
    },
    {
      name: 'Podcast',
      centerX: cx + 330,
      topY: bottomRowY,
      attributes: ['- show: string', '- episode: int'],
      methods: ['+ play()'],
    },
  ];

  const elements: Element[] = [];
  const boxByName = new Map<string, Element>();

  for (const c of classes) {
    // Attributes carry their type in the type column; methods are name-only,
    // so the column stays empty for them rather than repeating "()" twice.
    const fields: EntityField[] = [
      ...c.attributes.map((a) => {
        const [name, type] = a.split(': ');
        return type ? { name: name ?? a, type } : { name: a };
      }),
      ...c.methods.map((m) => ({ name: m })),
    ];
    const height = TITLE_H + fields.length * rowH;
    const box = {
      ...createShape('entity', c.centerX - classW / 2, c.topY),
      width: classW,
      height,
      label: c.name,
      entityFields: fields,
    };
    boxByName.set(c.name, box);
    elements.push(box);
  }

  // Inheritance: hollow triangle pointing at the parent (UML
  // generalisation). The subclasses sit below MediaItem, so the arrows
  // rise from their header tables into the parent's methods
  // compartment edge, converging on the shared bottom anchor.
  const parent = boxByName.get('MediaItem')!;
  for (const child of ['Song', 'Podcast']) {
    elements.push({
      ...createPinnedArrow(boxByName.get(child)!.id, 'n', parent.id, 's'),
      arrowheadShape: 'triangle-hollow',
    });
  }

  // Aggregation: hollow diamond at the Playlist (owner) end, with the
  // multiplicity as the edge label. Items live independently of any
  // playlist, hence aggregation rather than composition.
  elements.push({
    ...createPinnedArrow(boxByName.get('MediaItem')!.id, 'w', boxByName.get('Playlist')!.id, 'e'),
    arrowheadShape: 'diamond-hollow',
    label: '0..*',
  });

  return elements;
}

// An order lifecycle as a UML state machine: an initial dot, a chain
// of stadium states wired by event-labelled transitions, a Cancelled
// branch off the two states that can still abort, and a bullseye
// final marker. The initial / final markers lock their inks (like the
// Gantt bars lock their fills) so they stay solid black-dot notation
// under every theme.
export function buildStateMachine(cx: number, cy: number): Element[] {
  const stateW = 172;
  const stateH = 64;
  // Pitch leaves an ~90px gap between states so the event labels sit
  // on the transition, not on the neighbouring stadiums.
  const pitch = 260;
  // The Cancelled branch hangs 200px below the happy path, so the state
  // row rides high enough that the whole machine's bounding box centres
  // on (cx, cy) rather than drifting below it.
  const stateY = cy - 132;
  const INK = '#0f172a';

  const elements: Element[] = [];

  const states = ['Draft', 'Submitted', 'Paid', 'Shipped', 'Delivered'];
  const firstCenterX = cx - ((states.length - 1) / 2) * pitch;
  const stateEls = states.map((label, i) => ({
    ...createShape('stadium', firstCenterX + i * pitch - stateW / 2, stateY),
    width: stateW,
    height: stateH,
    label,
    textSize: 'md' as const,
    // Entry state soft, terminal success bold, the rest theme-plain.
    ...(label === 'Draft' ? { colorPreset: 'soft' } : {}),
    ...(label === 'Delivered' ? { colorPreset: 'bold' } : {}),
  }));
  elements.push(...stateEls);

  // Initial pseudo-state: a solid dot feeding the first state, sitting
  // one marker-gap off the chain's left edge on the state centreline.
  const markerGap = 96;
  const midY = stateY + stateH / 2;
  const dotSize = 26;
  const initialCenterX = firstCenterX - stateW / 2 - markerGap;
  const initial = {
    ...createShape('circle', initialCenterX - dotSize / 2, midY - dotSize / 2),
    width: dotSize,
    height: dotSize,
    fillColor: INK,
    strokeColor: INK,
    themeLockFill: true,
  };
  elements.push(initial);

  // Final state: the bullseye (an outlined ring around a locked solid
  // dot), grouped so it moves as one marker.
  const ringSize = 38;
  const coreSize = 22;
  const finalCenterX = firstCenterX + (states.length - 1) * pitch + stateW / 2 + markerGap;
  const finalGroup = crypto.randomUUID();
  const ring = {
    ...createShape('circle', finalCenterX - ringSize / 2, midY - ringSize / 2),
    width: ringSize,
    height: ringSize,
    fillColor: '#ffffff',
    strokeColor: INK,
    themeLockFill: true,
    groupId: finalGroup,
  };
  const core = {
    ...createShape('circle', finalCenterX - coreSize / 2, midY - coreSize / 2),
    width: coreSize,
    height: coreSize,
    fillColor: INK,
    strokeColor: INK,
    themeLockFill: true,
    groupId: finalGroup,
  };
  elements.push(ring, core);

  // Happy-path transitions, each labelled with the event that fires it.
  const events = ['submit', 'pay', 'ship', 'deliver'];
  events.forEach((event, i) => {
    elements.push({
      ...createPinnedArrow(stateEls[i]!.id, 'e', stateEls[i + 1]!.id, 'w'),
      label: event,
    });
  });
  elements.push(createPinnedArrow(initial.id, 'e', stateEls[0]!.id, 'w'));
  elements.push(createPinnedArrow(stateEls[states.length - 1]!.id, 'e', ring.id, 'w'));

  // The abort branch: an order can be cancelled while submitted, or
  // refunded once paid. Both fall into one Cancelled state below the
  // happy path, kept outline-styled so it reads as the exception.
  const cancelled = {
    ...createShape('stadium', cx - 195 - stateW / 2, stateY + 200),
    width: stateW,
    height: stateH,
    label: 'Cancelled',
    textSize: 'md' as const,
    colorPreset: 'outline',
  };
  elements.push(cancelled);
  elements.push({
    ...createPinnedArrow(stateEls[1]!.id, 's', cancelled.id, 'n'),
    label: 'cancel',
  });
  elements.push({
    ...createPinnedArrow(stateEls[2]!.id, 's', cancelled.id, 'n'),
    label: 'refund',
  });

  return elements;
}
