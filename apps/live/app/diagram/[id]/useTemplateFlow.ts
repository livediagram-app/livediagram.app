import type { Dispatch, SetStateAction } from 'react';
import type { Tab } from '@livediagram/diagram';
import { track, titleCaseType } from '@/lib/telemetry';
import { getTheme, recolourElementForTheme, THEMES, type ThemeId } from '@/lib/themes';
import { templateCanvasOverrides, type TemplateKind } from '@/lib/templates';
import type { Participant } from '@/lib/identity';
import { patchTab } from './editor-page-helpers';

type SetState<T> = Dispatch<SetStateAction<T>>;
type TemplatePickerMode = 'welcome' | 'templates' | 'identity';

// Template / identity modal actions, lifted out of editor-page.tsx:
// open the per-tab template picker, skip it, or choose a template (mint
// the scaffold via the lazily-imported builders, recolour to the chosen
// theme, apply canvas overrides). `confirmName` stays in the page (it's
// also wired into useShareLinks) and is passed in.
export function useTemplateFlow(opts: {
  activeId: string;
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

  const chooseTemplate = async (kind: TemplateKind, name?: string, themeId?: ThemeId) => {
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
    // Telemetry (spec/22): a template was applied; `type` is the kind.
    // The picker also lets the user pick a theme alongside the template,
    // so emit Theme / Changed in the same flow that /live/new uses for
    // its symmetric "create with a chosen theme" event.
    track('Template', 'Used', titleCaseType(kind));
    if (themeId) {
      const themeLabel =
        THEMES.find((t) => t.id === themeId)?.label ??
        themeId.charAt(0).toUpperCase() + themeId.slice(1);
      track('Theme', 'Changed', themeLabel);
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
    const elements = !theme
      ? rawElements
      : rawElements.map((el) => recolourElementForTheme(el, theme));
    // Apply the picker's theme choice at the same time as the
    // template scaffold so the user lands on a fully themed canvas
    // in one step instead of having to revisit the Theme accordion.
    const patch: Partial<Tab> = {
      elements,
      templateChosen: true,
      ...(theme && themeId
        ? {
            theme: themeId,
            backgroundColor: theme.backgroundColor,
            backgroundPattern: theme.backgroundPattern,
            patternColor: theme.patternColor,
          }
        : {}),
      ...templateCanvasOverrides(kind),
    };
    commitTabs((ts) => patchTab(ts, activeId, patch));
    // Auto-select when a template produces a single element (today: blank
    // diagram's seeded rectangle) so the user can immediately rename or edit
    // it. Multi-element templates leave the selection cleared.
    setSelectedId(elements.length === 1 ? elements[0]!.id : null);
    setEditingId(null);
  };

  return { openTemplatePicker, skipTemplatePicker, chooseTemplate };
}
