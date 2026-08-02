// The shape vocabulary: every kind a shape element can be, from the basic
// geometry through the flowchart set, the UML set, the device frames and the
// self-drawing data shapes.
//
// Split out of index.ts the same way element-types.ts and arrow-types.ts were,
// and it is the easiest of the three to justify: one union, ~100 members, and
// it references nothing else in the package and nothing else references it by
// anything other than name. A closed vocabulary that only ever grows is
// exactly the kind of thing that should not sit in the middle of the file
// holding the package's public surface.
//
// Pure types; re-exported through index.ts so the public
// `@livediagram/diagram` surface is unchanged.

export type ShapeKind =
  | 'square'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'parallelogram'
  | 'hexagon'
  | 'document'
  // Document element (spec/100). Named 'page' because 'document' above is
  // the flowchart output symbol.
  | 'page'
  // Mind node (spec/118): a labelled node that knows its parent, grown from
  // the keyboard with Tab (child) and Enter (sibling).
  | 'mind-node'
  // Lane (spec/119): a titled horizontal band that carries its contents.
  | 'lane'
  // Record (spec/120): a UML class / ER entity box — a title over rows.
  | 'entity'
  // Mode button (spec/103): a pressable pill that switches whoever clicks it
  // into a selection mode — Avatar by default. Which mode lives in the
  // element's `mode` field.
  | 'mode-button'
  // Portal (spec/104): a portal. Clicking one — or walking an Avatar-mode
  // character into it — takes you to the portal it is paired with, in
  // `portalTarget`.
  | 'portal'
  // Session button (spec/105): pressing it starts a session tool for the room
  // — a timer, a dot vote, or a live poll. Which one lives in `session`.
  | 'session-button'
  // Reveal zone (spec/106): a cover over part of the canvas. Click it to
  // uncover it for yourself; `revealed` uncovers it for everyone.
  | 'reveal'
  // Picker (spec/107): press it to choose a person or an option at random.
  | 'picker'
  // Reaction pad (spec/135): press it, or walk an Avatar-mode character onto
  // it, and a burst of reaction plays over the pad. Which reaction lives in
  // the element's `reaction` field.
  | 'reaction-pad'
  // Chair (spec/130): furniture an Avatar-mode character sits down in when it
  // walks into one. Which way the seat points lives in `chairFacing`.
  | 'chair'
  // The collaboration family — elements that record what the ROOM thinks
  // rather than what one author drew.
  //
  // Estimate card (spec/123): planning poker. Everyone picks privately from
  // `estimateScale`, and `responsesRevealed` shows every answer at once.
  | 'estimate'
  // Temperature check (spec/124): a fist-of-five gauge. Same `responses`
  // primitive, deliberately never hidden.
  | 'temperature'
  // Idea box (spec/125): anonymous submissions in `ideaCards`, held until
  // `ideasRevealed`. There is nowhere to put an author, on purpose.
  | 'idea-box'
  // Agenda (spec/127): ordered `agendaItems` with minutes; pressing one starts
  // the tab timer and sets `agendaCurrent`.
  | 'agenda'
  // Decision record (spec/128): the statement (the label) plus a status chip,
  // a date and the drivers.
  | 'decision'
  // Roll call (spec/129): a frozen snapshot of who was in the room, in
  // `rollCall`.
  | 'roll-call'
  | 'stadium'
  | 'actor'
  | 'cloud'
  | 'triangle'
  | 'trapezoid'
  | 'star'
  // Speech bubble / callout: a rounded body with a tail at the bottom-left.
  | 'speech-bubble'
  // Frame / section: a transparent outlined container with its label in the
  // top-left, drawn around a cluster of elements. See spec/09.
  | 'frame'
  // UI device frames (wireframing). See spec/09 "Devices" accordion.
  | 'browser'
  | 'monitor'
  | 'laptop'
  | 'phone'
  | 'tablet'
  | 'smartwatch'
  // Progress elements (spec/46): a horizontal bar + a donut ring that show a
  // 0–100 percentage. They carry `progress` / `progressAnim` (below).
  | 'progress-bar'
  | 'progress-ring'
  // Timeline rail (spec/51): a horizontal line with evenly-spaced points above
  // it. Carries `railCount` (below); a canvas affordance adds points at the
  // right end. The first of a family of composite "rail" components.
  | 'timeline-rail'
  // Rating (spec/52): a row of five stars showing a 1–5 score. Carries
  // `rating` / `ratingAnim` (below).
  | 'rating'
  // Pie + bar charts (spec/53): data charts sized by value. Share `pieSlices` /
  // `pieAnim` / `chartLegend` (below). The "Data" component family.
  | 'pie-chart'
  | 'bar-chart'
  // Line chart (spec/53): a 2-D chart with `lineCategories` + `lineSeries`
  // (CSV-importable). Shares `pieAnim` / `chartLegend`.
  | 'line-chart'
  // Code block (spec/82): a monospace snippet card. Carries `code` +
  // `codeLanguage` (below); keeps a fixed dark identity regardless of theme.
  | 'code-block'
  // Checklist (spec/83): checkable to-do rows. Carries `checklistItems`
  // (below); boxes toggle on-canvas like the rating's stars.
  | 'checklist'
  // Curated single-colour glyph from the icon catalogue. Which glyph
  // is carried by `iconId` (a registry key resolved in the live app's
  // icon catalogue, NOT a closed enum here, so adding icons is a
  // one-file change with no model migration). Tinted by `strokeColor`
  // like a line drawing; keeps aspect ratio when resized. See spec/09
  // "Icons" accordion.
  | 'icon'
  // Sticker (spec/116): a die-cut colour sticker you slap on the board — a
  // colour emoji, or a word badge like APPROVED / BLOCKED. Which one is
  // carried by `stickerId` (a catalogue key, not a closed enum here, same as
  // `iconId`). Deliberately NOT an icon: it paints its own plate + shadow,
  // is never tinted by the theme, carries no caption, and never folds into
  // another shape as an inline glyph.
  | 'sticker';
