// The Tab type (docs/specs/006-project/project-structure.md): one tab's elements, look and settings, and a Plan
// tab's own parts. Re-exported from the package root (./index). Type-only imports, so nothing here exists at runtime.
import type { FormDefinition } from '@liveplanner/forms';
import type { TabId, TextSize } from '@liveworkspace/model-core/basics';
import type { TagColour } from './tag-colours';
import type { TabKind } from './tab-kind';
import type { DashboardLayout } from './dashboard';
import type { TabTimer, TabVote } from './session';
import type { Layer } from './layers';
import type { Finish } from './finish';
import type { BackgroundPattern } from './retired-patterns';
import type { Element } from './element-union';

// What KIND a tab is (./tab-kind): an ordinary diagram tab, or one of Plan's Board, Sheet,
// Dashboard and Form tabs. This is deliberately a FIRST-CLASS field rather than something
// inferred from the tab's contents. The editor stays one editor: a kind tunes presentation, it
// does not fork persistence, realtime, comments or export.
//
// 'diagram' is an ordinary tab and is written explicitly onto tabs the
// editor commits; tabs stored before the field carry nothing, which reads
// as 'diagram' via `tabKindOf` (see ./tab-kind).

export type Tab = {
  id: TabId;
  name: string;
  kind?: TabKind;
  // A Dashboard tab's rows and slots (docs/specs/026-plan/plan-tabs.md "Dashboard tab"), read via `readDashboard`.
  dashboard?: DashboardLayout;
  // A Form tab's form (docs/specs/030-forms/forms.md), read via `readForm` from @liveplanner/forms.
  form?: FormDefinition;
  // The colours someone picked with + in a colour picker on this tab, newest first, lower-case
  // `#rrggbb` (docs/specs/004-interface-design/colour-picker.md "Custom colours"). Read via
  // `customColoursOf`; every picker in the project offers them as Custom Colours.
  customColours?: string[];
  // Tag colours (docs/specs/009-elements/tag-colours.md): a card tag mapped to a colour, read with `tagColoursOf`.
  tagColours?: TagColour[];
  elements: Element[];
  backgroundPattern?: BackgroundPattern;
  backgroundColor?: string;
  // 0..1, defaults to 1. Applied to backgroundColor as the alpha
  // channel so the canvas can sit over a transparent / lower-opacity
  // backdrop (useful when embedded or layered on a theme).
  backgroundOpacity?: number;
  patternColor?: string;
  // Pattern tile scale, defaults to 1. Multiplies the rendered pattern's
  // tile size so the user can make the grid / dots / texture larger or
  // smaller (the canvas pattern-size slider). Does not affect the pan
  // phase, so the pattern still tracks panning at any scale.
  backgroundPatternScale?: number;
  // Motion speed for an ANIMATED background pattern (docs/specs/008-canvas/canvas-and-palette.md), defaults to
  // 1. A rate multiplier (2 = twice as fast) fed to the animated backdrop's
  // keyframes; ignored by the static patterns. The canvas Speed slider
  // (shown only while an animated pattern is active) writes it.
  backgroundAnimationSpeed?: number;
  // Selected preset theme name (see apps/editor/lib/themes.ts). Setting
  // a theme via the palette repaints every existing element on the tab
  // to match (sticky notes keep their amber palette). Newly added
  // elements inherit the same theme colours by default. Unset = brand
  // defaults.
  theme?: string;
  // Default font-family id for this tab (see ../packages/model-core/src/fonts.ts).
  // Every text-bearing element without its own `font` renders in this
  // one; unset = the editor default. Lets a whole tab adopt a font in
  // one move while individual elements can still override.
  font?: string;
  // Drawing style for every element without its own (docs/specs/008-canvas/finish.md); unset = Flexible.
  finish?: Finish;
  // Default text size for NEW elements added from the palette on this
  // tab. Unlike `font`, this is a create-time seed: copied onto each
  // new element's own `textSize`, not resolved at render: so changing
  // it later doesn't retroactively resize existing elements. Unset = the
  // per-type factory default ('md').
  defaultTextSize?: TextSize;
  // Set to true once the user has explicitly chosen a starting template
  // (including "Blank"), so the template picker doesn't reappear on this tab.
  templateChosen?: boolean;
  // True when the tab is locked: every element becomes read-only,
  // adds via the palette are blocked, theme / background mutations
  // are blocked for as long as this tab is active. Toggled from the
  // tab ellipsis menu.
  locked?: boolean;
  // Per-project folder name (docs/specs/006-project/tab-folders.md). Tabs sharing a name render
  // as a contiguous run under one collapsible chip in the tab bar.
  // This is link metadata, not body content: it's stripped from the
  // persisted tab body and carried on the plan_tabs row alongside
  // order_index, so a shared tab can be foldered in one project and
  // loose in another. Unset / empty = loose. See tab-folders.ts for
  // the normalize + grouping helpers.
  folder?: string;
  // Live session tools (docs/specs/012-collaboration/session-tools.md), facilitator-run + synced to every
  // participant via the normal tab sync. `timer` is a countdown /
  // stopwatch; `vote` is a dot-voting session. Both are edit-role
  // controlled (the room drops view-role mutations) and absent until a
  // facilitator starts one. See session.ts for the pure helpers.
  timer?: TabTimer;
  vote?: TabVote;
  // Photoshop-style layers (docs/specs/006-project/layers.md), ordered BOTTOM -> TOP (index 0
  // paints lowest). Absent = the tab behaves as one implicit default
  // layer; the array is materialised lazily on the first layer
  // operation (see layers.ts). Elements point in via `layerId`.
  layers?: Layer[];
};
