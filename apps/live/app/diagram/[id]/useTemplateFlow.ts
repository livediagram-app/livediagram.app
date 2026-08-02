import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Tab } from '@livediagram/diagram';
import { track, titleCaseType } from '@/lib/telemetry';
import { getTheme, recolourElementsForTheme, switchThemeBackdrop } from '@/lib/themes';
import { themeTelemetryLabel } from '@/lib/custom-theme-registry';
import { templateCanvasOverrides, type TemplateKind } from '@livediagram/templates';
import type { Participant } from '@/lib/identity';
import { patchTab } from './editor-page-helpers';

type SetState<T> = Dispatch<SetStateAction<T>>;
type TemplatePickerMode = 'welcome' | 'templates' | 'identity';

// What the Quick Start picker should do when the mode or the active tab
// moves under it. Pure so the rule is testable without rendering the hook:
//
//   'reset'  — picker isn't open; forget which tab it belonged to
//   'record' — picker just opened; remember the tab it's asking about
//   'close'  — the user switched tabs; the picker is stale, dismiss it
//   'keep'   — still on its own tab, leave it alone
export function templatePickerTabAction(
  mode: TemplatePickerMode,
  pickerTabId: string | null,
  activeId: string,
): 'reset' | 'record' | 'close' | 'keep' {
  if (mode !== 'templates') return 'reset';
  if (pickerTabId === null) return 'record';
  return pickerTabId === activeId ? 'keep' : 'close';
}

// Template / identity modal actions, lifted out of editor-page.tsx:
// open the per-tab template picker, skip it, or choose a template (mint
// the scaffold via the lazily-imported builders, recolour to the chosen
// theme, apply canvas overrides). `confirmName` stays in the page (it's
// also wired into useShareLinks) and is passed in.
export function useTemplateFlow(opts: {
  activeId: string;
  // The live tab list, read only to check whether the tab a template is
  // about to land on is genuinely empty (see chooseTemplate's backstop).
  tabs: Tab[];
  templatePickerMode: TemplatePickerMode;
  selfParticipant: Participant;
  getViewportCenter: () => { x: number; y: number };
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  confirmName: () => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  setSelfParticipant: SetState<Participant>;
  setTemplatePickerMode: SetState<TemplatePickerMode>;
}) {
  const {
    activeId,
    tabs,
    templatePickerMode,
    selfParticipant,
    getViewportCenter,
    commitTabs,
    confirmName,
    setSelectedId,
    setEditingId,
    setSelfParticipant,
    setTemplatePickerMode,
  } = opts;

  // Quick Start belongs to the tab it was opened on. Both entry points
  // (adding a tab, the empty-canvas button) only fire for an EMPTY active
  // tab, but the modal used to survive a tab switch underneath it — and
  // `chooseTemplate` writes to whatever tab is active when you confirm.
  // Add a tab, switch back to a tab with work on it, pick a template, and
  // the scaffold replaced that tab's elements. Close the picker instead:
  // the tab it was asking about is no longer the one on screen.
  //
  // The ref records the tab the picker opened on rather than diffing
  // activeId, because `addTab` sets the new active tab AND opens the
  // picker in the same commit — a plain "activeId changed" effect would
  // close the picker in the very render that opened it.
  const pickerTabRef = useRef<string | null>(null);
  useEffect(() => {
    const action = templatePickerTabAction(templatePickerMode, pickerTabRef.current, activeId);
    if (action === 'reset') pickerTabRef.current = null;
    else if (action === 'record') pickerTabRef.current = activeId;
    else if (action === 'close') setTemplatePickerMode('welcome');
  }, [templatePickerMode, activeId, setTemplatePickerMode]);

  const openTemplatePicker = () => {
    setTemplatePickerMode('templates');
    commitTabs((ts) => patchTab(ts, activeId, { templateChosen: false }));
  };

  const skipTemplatePicker = () => {
    if (templatePickerMode === 'identity') {
      confirmName();
      setTemplatePickerMode('welcome');
      return;
    }
    commitTabs((ts) => patchTab(ts, activeId, { templateChosen: true }));
    confirmName();
    setTemplatePickerMode('welcome');
  };

  const chooseTemplate = async (kind: TemplateKind, name?: string, themeId?: string) => {
    // Identity-only mode: the visitor is joining an existing diagram.
    // No template scaffold, no theme application — just commit the name
    // and dismiss the modal.
    if (templatePickerMode === 'identity') {
      if (name && name !== selfParticipant.name) {
        setSelfParticipant((p) => ({ ...p, name }));
      }
      confirmName();
      setTemplatePickerMode('welcome');
      return;
    }
    // Backstop against the same data loss the effect above prevents.
    // Applying a template REPLACES the tab's elements, and every route
    // into this picker is gated on an empty tab — so a confirm landing on
    // a tab with work on it means the modal outlived the tab it was
    // opened for. Dismiss it and touch nothing rather than wipe the tab.
    if ((tabs.find((t) => t.id === activeId)?.elements.length ?? 0) > 0) {
      setTemplatePickerMode('welcome');
      return;
    }
    // Telemetry (spec/22): a template was applied; `type` is the kind.
    // The picker also lets the user pick a theme alongside the template,
    // so emit Theme / Changed in the same flow that /live/new uses for
    // its symmetric "create with a chosen theme" event.
    track('Template', 'Used', titleCaseType(kind));
    if (themeId) {
      track('Theme', 'Changed', themeTelemetryLabel(themeId));
    }
    // Templates flow: applying a template / theme to an existing tab.
    // The diagram already exists in D1; no mint required.
    if (name && name !== selfParticipant.name) {
      setSelfParticipant((p) => ({ ...p, name }));
    }
    confirmName();
    setTemplatePickerMode('welcome');
    const centre = getViewportCenter();
    // Dynamic-import the heavy builders module only when the user
    // actually picks a template. The ~1700 lines of build* code stays
    // out of the editor's initial chunk; returning users opening an
    // existing diagram never download it.
    const { buildTemplate } = await import('@/lib/template-builders');
    const rawElements = buildTemplate(kind, centre.x, centre.y);
    const theme = themeId ? getTheme(themeId) : null;
    // Repaint the scaffold with the chosen theme so the Mind map circles,
    // Org chart boxes etc. land in the user's selected colours rather
    // than the hard-coded brand defaults from `buildTemplate`. Sticky
    // notes (Retrospective) keep their amber identity — same rule
    // `addBoxed` applies to ad-hoc sticky creation.
    // Shared recolour helper so the in-editor template picker
    // can't drift from the /live/new path (`buildTemplatedTab` in
    // lib/templates.ts uses the same function). The previous
    // inline copy here omitted the arrow case, so arrows in
    // mindmap / flowchart / flywheel templates picked from inside
    // the editor stayed brand-blue instead of inheriting the
    // theme's stroke colour.
    // Graph-aware recolour (multi-colour themes tint each branch a
    // different hue — spec/29); single-colour themes fall through to the
    // per-element transform unchanged.
    const elements = !theme ? rawElements : recolourElementsForTheme(rawElements, theme);
    // Apply the picker's theme choice at the same time as the
    // template scaffold so the user lands on a fully themed canvas
    // in one step instead of having to revisit the Theme accordion.
    // The backdrop goes through the same switchThemeBackdrop
    // preserve-customs rule as the Theme accordion (spec/09): a
    // custom canvas colour / pattern, including one a fresh tab
    // inherited from its source tab via the new-tab seed, survives
    // confirming a template under the unchanged theme. Hard-coding
    // the theme's defaults here used to reset the inherited backdrop
    // even though the picker pre-selects the current theme. The
    // per-template pattern override still wins at creation time.
    const overrides = templateCanvasOverrides(kind);
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        const backdrop = theme && themeId ? switchThemeBackdrop(t, getTheme(t.theme), theme) : null;
        return {
          ...t,
          elements,
          templateChosen: true,
          ...(backdrop && themeId ? { theme: themeId, ...backdrop } : {}),
          ...overrides,
        };
      }),
    );
    // Auto-select when a template produces a single element so the user can
    // immediately rename or edit it. Multi-element templates — and the now
    // truly-empty Blank template (zero elements) — leave the selection cleared.
    setSelectedId(elements.length === 1 ? elements[0]!.id : null);
    setEditingId(null);
  };

  return { openTemplatePicker, skipTemplatePicker, chooseTemplate };
}
