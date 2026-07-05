// "Show me around" guided-tour builder (spec/69). Layout lifted from a
// hand-arranged reference diagram: six large dashed section panels in a
// two-column grid, walked in reading order by dashed-flow arrows
// (Palette, Editing Elements, then down the right column to Arrows,
// across to Collaboration, down to Selection Modes, across to
// Explorer). Each section pairs demonstrative elements with small
// captions, plus one annotation marker (spec/38) carrying the deeper
// lesson. Every note describes a real, shipped interaction; if an
// interaction changes, this copy changes in the same PR.
//
// The section panels pin their soft grey fill with `themeLockFill` so
// they stay quiet containers under every theme; everything else takes
// the applied theme's colours.

import {
  createAnnotation,
  createImage,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Element,
  type ShapeKind,
} from '@livediagram/diagram';

// The reference diagram's grid: two 702x680 columns, three rows.
const SECTION = { w: 702, h: 680 };
const COL_X = [-661, 211] as const;
const ROW_Y = [-702, 108, 978] as const;
// The scene in reference coords spans x -661..913, y -901..1658; this
// offset recentres it so buildTemplate's (cx, cy) is the visual middle.
const OX = -126;
const OY = -378;

const SECTION_FILL = '#f8fafc';

export function buildGuidedTour(cx: number, cy: number): Element[] {
  const elements: Element[] = [];
  const X = (x: number) => cx + OX + x;
  const Y = (y: number) => cy + OY + y;

  // Small helpers, all in reference coords. `cap` is the little caption
  // row under a group of samples; `icon` a palette icon tile.
  const text = (
    x: number,
    y: number,
    w: number,
    label: string,
    opts?: { textSize?: 'sm' | 'scale'; textBold?: boolean },
  ) => {
    elements.push({
      ...createText(X(x), Y(y)),
      width: w,
      height: 36,
      label,
      textSize: 'sm' as const,
      ...opts,
    });
  };
  const shape = (kind: ShapeKind, x: number, y: number, w: number, h: number, extra?: object) => {
    const el = { ...createShape(kind, X(x), Y(y)), width: w, height: h, ...extra };
    elements.push(el);
    return el;
  };
  const icon = (iconId: string, x: number, y: number, size: number, label?: string) => {
    shape('icon', x, y, size, size, {
      iconId,
      ...(label ? { label, textSize: 'sm' as const } : {}),
    });
  };
  const note = (x: number, y: number, message: string) => {
    elements.push({ ...createAnnotation(X(x), Y(y)), note: message });
  };
  // A section panel: the dashed container (fill pinned so it survives
  // theming as a quiet wash) plus its one-line subtitle. Returns the
  // panel so the guiding arrows can pin to it.
  const section = (col: 0 | 1, row: 0 | 1 | 2, title: string, subtitle: string) => {
    const panel = shape('square', COL_X[col], ROW_Y[row], SECTION.w, SECTION.h, {
      label: title,
      textSize: 'md' as const,
      textBold: true,
      strokeStyle: 'dashed' as const,
      textAlignX: 'center' as const,
      textAlignY: 'top' as const,
      fillColor: SECTION_FILL,
      themeLockFill: true,
    });
    text(COL_X[col] + 11, ROW_Y[row] + 47, 649, subtitle);
    return panel;
  };

  // --- Header ---------------------------------------------------------
  text(-259, -901, 600, 'Welcome to livediagram', { textSize: 'scale', textBold: true });
  text(
    -259,
    -831,
    600,
    'Hover over the small annotations to learn the basics, then make this canvas yours.',
  );

  // --- 1. Palette (top-left) -- the reference section, kept verbatim --
  const palette = section(
    0,
    0,
    'Palette',
    'Add new items to the canvas from the Palette in the top right.',
  );
  const P = { x: COL_X[0], y: ROW_Y[0] };
  shape('square', P.x + 30, P.y + 127, 76, 76);
  shape('circle', P.x + 120, P.y + 127, 76, 76);
  shape('diamond', P.x + 209, P.y + 127, 76, 76);
  text(P.x + 26, P.y + 207, 259, 'Shapes');
  elements.push({ ...createSticky(X(P.x + 409), Y(P.y + 127)), width: 76, height: 76 });
  elements.push({ ...createImage(X(P.x + 502), Y(P.y + 128)), width: 118, height: 75 });
  text(P.x + 401, P.y + 215, 273, 'Tools');
  note(
    P.x + 630,
    P.y + 143,
    'I am an annotation. Hover a marker like me to read a note pinned right where it matters.',
  );
  shape('browser', P.x + 30, P.y + 290, 217, 154);
  shape('smartwatch', P.x + 279, P.y + 306, 148, 124);
  shape('tablet', P.x + 453, P.y + 290, 202, 154);
  text(P.x + 30, P.y + 457, 644, 'Devices');
  icon('calendar', P.x + 31, P.y + 536, 61);
  icon('mail', P.x + 107, P.y + 536, 61);
  icon('check-circle', P.x + 184, P.y + 536, 61);
  icon('map-pin', P.x + 262, P.y + 536, 61);
  text(P.x + 30, P.y + 612, 292, 'Icons');
  icon('aws-ec2', P.x + 409, P.y + 528, 84, 'EC2');
  icon('aws-lambda', P.x + 494, P.y + 528, 84, 'Lambda');
  icon('aws-apigateway', P.x + 578, P.y + 528, 84, 'Gateway');
  text(P.x + 382, P.y + 620, 292, 'Technologies');

  // --- 2. Editing Elements (top-right) ---------------------------------
  const editing = section(
    1,
    0,
    'Editing Elements',
    'Select an existing element to edit its properties.',
  );
  const E = { x: COL_X[1], y: ROW_Y[0] };
  shape('square', E.x + 30, E.y + 127, 180, 86, { label: 'Double-click me' });
  shape('square', E.x + 250, E.y + 127, 150, 86, { label: 'Rotate me', rotation: 12 });
  shape('circle', E.x + 450, E.y + 117, 106, 106, {
    label: 'Done',
    marker: 'green-circle' as const,
  });
  text(E.x + 30, E.y + 237, 640, 'Rename, rotate, and pin status markers');
  shape('square', E.x + 30, E.y + 300, 150, 80, {
    label: 'Dashed',
    strokeStyle: 'dashed' as const,
  });
  shape('square', E.x + 210, E.y + 300, 150, 80, { label: 'Thick', strokeWidth: 'thick' as const });
  shape('square', E.x + 390, E.y + 300, 170, 80, {
    label: 'Blocked',
    marker: 'red-circle' as const,
  });
  text(E.x + 30, E.y + 395, 640, 'Right-click any element for colours, borders and layers');
  shape('progress-bar', E.x + 30, E.y + 470, 220, 44, { progress: 72 });
  shape('rating', E.x + 280, E.y + 470, 200, 44);
  shape('progress-ring', E.x + 520, E.y + 440, 120, 120, { progress: 72 });
  text(E.x + 30, E.y + 545, 640, 'Data shapes update as you edit their values');
  note(
    E.x + 630,
    E.y + 127,
    'Select an element and right-click it: colours, borders, markers, animations and layer order all live in that menu.',
  );

  // --- 3. Arrows (middle-right) -----------------------------------------
  const arrows = section(1, 1, 'Arrows', 'Drag between shapes and the lines stay connected.');
  const A = { x: COL_X[1], y: ROW_Y[1] };
  const a1 = shape('square', A.x + 40, A.y + 140, 120, 80, { label: 'A' });
  const a2 = shape('square', A.x + 330, A.y + 140, 120, 80, { label: 'B' });
  elements.push({ ...createPinnedArrow(a1.id, 'e', a2.id, 'w'), label: 'drag my ends' });
  text(A.x + 30, A.y + 250, 440, 'Hover a shape, drag a + handle to connect');
  const a3 = shape('circle', A.x + 40, A.y + 330, 100, 100, { label: 'C' });
  const a4 = shape('diamond', A.x + 330, A.y + 320, 130, 110, { label: 'D' });
  elements.push({
    ...createPinnedArrow(a3.id, 'e', a4.id, 'w'),
    label: 'curved',
    arrowStyle: 'curved' as const,
    flow: 'dashes' as const,
  });
  text(A.x + 30, A.y + 460, 440, 'Curves, elbows, dashes and animated flow');
  const a5 = shape('square', A.x + 40, A.y + 530, 110, 70, { label: 'E' });
  const a6 = shape('square', A.x + 350, A.y + 545, 110, 70, { label: 'F' });
  elements.push({ ...createPinnedArrow(a5.id, 'e', a6.id, 'w'), arrowStyle: 'angled' as const });
  note(
    A.x + 630,
    A.y + 140,
    'Move a shape and every pinned arrow re-routes itself. Double-click an arrow to give it a label.',
  );

  // --- 4. Collaboration (middle-left) -----------------------------------
  const collab = section(0, 1, 'Collaboration', 'Work on the same canvas together, live.');
  const C = { x: COL_X[0], y: ROW_Y[1] };
  const you = shape('circle', C.x + 40, C.y + 150, 110, 110, { label: 'You' });
  const sam = shape('circle', C.x + 300, C.y + 150, 110, 110, { label: 'Sam' });
  elements.push({ ...createPinnedArrow(you.id, 'e', sam.id, 'w'), flow: 'beads' as const });
  text(C.x + 30, C.y + 290, 420, 'Cursors, selections and edits appear as they happen');
  elements.push({
    ...createSticky(X(C.x + 470), Y(C.y + 140)),
    width: 180,
    height: 180,
    label: 'Share a link. No sign-up needed to join.',
  });
  elements.push({
    ...createSticky(X(C.x + 40), Y(C.y + 390)),
    width: 200,
    height: 200,
    label: 'Comments and assigned actions live in the right-click menu.',
    rotation: 2,
  });
  note(
    C.x + 630,
    C.y + 150,
    'Share (top right) makes a live link, view-only or editable, with an optional password. Workshopping? The tab menu has a timer and dot-voting.',
  );

  // --- 5. Selection Modes (bottom-left) ---------------------------------
  const selection = section(
    0,
    2,
    'Selection Modes',
    'Click one, shift-click more, or drag a box around many.',
  );
  const S = { x: COL_X[0], y: ROW_Y[2] };
  shape('square', S.x + 40, S.y + 140, 110, 70, { label: 'One' });
  shape('square', S.x + 180, S.y + 140, 110, 70, { label: 'Two' });
  shape('square', S.x + 320, S.y + 140, 110, 70, { label: 'Three' });
  text(S.x + 30, S.y + 250, 400, 'Drag on empty canvas to marquee-select these');
  const groupId = crypto.randomUUID();
  shape('circle', S.x + 480, S.y + 120, 90, 90, { groupId });
  shape('square', S.x + 480, S.y + 230, 90, 60, { groupId });
  text(S.x + 450, S.y + 310, 170, 'Grouped: moves as one');
  shape('square', S.x + 40, S.y + 360, 140, 80, { label: 'Locked', locked: true });
  text(S.x + 30, S.y + 460, 400, 'Locked elements stay put until unlocked');
  note(
    S.x + 630,
    S.y + 140,
    "Select several and press Cmd/Ctrl+G to group them. Cmd/Ctrl+Shift+L locks anything you don't want nudged.",
  );

  // --- 6. Explorer (bottom-right) ---------------------------------------
  const explorer = section(
    1,
    2,
    'Explorer',
    'Every diagram you make, in the panel on the top left.',
  );
  const Q = { x: COL_X[1], y: ROW_Y[2] };
  shape('document', Q.x + 40, Q.y + 140, 160, 110, { label: 'Roadmap' });
  shape('document', Q.x + 230, Q.y + 140, 160, 110, { label: 'Retro board' });
  shape('document', Q.x + 420, Q.y + 140, 160, 110, { label: 'Ideas' });
  text(Q.x + 30, Q.y + 270, 550, 'Jump between diagrams and organise them into folders');
  shape('cylinder', Q.x + 80, Q.y + 380, 180, 110, { label: 'Team library' });
  shape('actor', Q.x + 330, Q.y + 360, 100, 130, { label: 'Teammates' });
  text(Q.x + 30, Q.y + 510, 440, 'Teams share one library every member can edit');
  note(
    Q.x + 630,
    Q.y + 140,
    'Tabs live in the bar at the bottom: one diagram can hold many pages, grouped into folders.',
  );

  // --- The guided path: dashed-flow arrows walking the sections in
  // reading order (a serpentine through the grid).
  const path: [Element, 'n' | 'e' | 's' | 'w', Element, 'n' | 'e' | 's' | 'w'][] = [
    [palette, 'e', editing, 'w'],
    [editing, 's', arrows, 'n'],
    [arrows, 'w', collab, 'e'],
    [collab, 's', selection, 'n'],
    [selection, 'e', explorer, 'w'],
  ];
  for (const [from, fa, to, ta] of path) {
    elements.push({ ...createPinnedArrow(from.id, fa, to.id, ta), flow: 'dashes' as const });
  }

  return elements;
}
