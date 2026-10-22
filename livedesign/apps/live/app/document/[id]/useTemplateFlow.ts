import type { Dispatch, SetStateAction } from 'react';
import type { EditorMode, Tab } from '@livedesign/document';
import type { ItemCreate } from '@livedesign/items';
import { track, titleCaseType } from '@/lib/telemetry';
import { getTheme, recolourElementsForTheme } from '@/lib/themes';
import {
  formTemplateStarter,
  isFormTemplateKind,
  isPlanTemplateKind,
  withBlankPageThemed,
  type TemplateKind,
} from '@livedesign/templates';
import type { StarterId } from '@livedesign/forms';
import { templateTabName } from '@/lib/template-tab-name';
import type { Participant } from '@/lib/identity';
import { landTemplateOnTab, templateFollowerTabs } from './template-tab-set';

type SetState<T> = Dispatch<SetStateAction<T>>;
// The mode a chosen template's tab opens in (docs/specs/007-editor/editor-modes.md "Where the
// mode lives"): the Whiteboard draws, every other template is a diagram, Blank included, even on
// a tab that opened in Draw.
// Undefined leaves the tab as is.
export function templateOpensIn(overrides: Pick<Tab, 'opensIn' | 'kind'>): EditorMode | undefined {
  if (overrides.opensIn) return overrides.opensIn;
  return overrides.kind ? undefined : 'diagram';
}

// Template and identity actions, lifted out of editor-page.tsx: choose a template from a start (mint the scaffold via
// the lazily-imported builders, recolour to the tab's theme, apply canvas overrides), and answer the visitor name prompt
// (docs/specs/007-editor/new-document-route.md). `confirmName` stays in the page (it's also wired into useShareLinks)
// and is passed in.
export function useTemplateFlow(opts: {
  activeId: string;
  // The live tab list, read only to check whether the tab a template is
  // about to land on is genuinely empty (see chooseTemplate's backstop).
  tabs: Tab[];
  selfParticipant: Participant;
  // The document's name, and naming it (docs/specs/007-editor/templates-by-mode.md "The document's name"): a template
  // picked on the first tab names a still-untitled document after itself.
  documentName: string;
  nameDocument: (name: string) => void;
  getViewportCenter: () => { x: number; y: number };
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  confirmName: () => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  setSelfParticipant: SetState<Participant>;
  // The visitor name prompt (IdentityPrompt).
  setIdentityPromptOpen: SetState<boolean>;
  // Frames the tab once the template's elements have rendered (useTabEntryEffects).
  requestFit: () => void;
  // Puts down whatever tool is in hand, for Select (docs/specs/023-draw-mode/draw-mode.md "Opening tool"): a
  // template's content makes the tab one with content, and such a tab opens on Select.
  putToolDown: () => void;
  // A tab a template adds has no server row to fetch yet (useEditorState's markTabLoaded).
  markTabLoaded: (id: string) => void;
  // Adds the card types the template's boards bring, every tab's (usePresetCardTypes' bring).
  bringCardTypes: (elements: Tab['elements']) => void;
  // Makes a Plan template's example cards (docs/specs/026-plan/plan-templates.md "Example cards"), as one write.
  seedCards: (creates: readonly ItemCreate[]) => void;
  // A form template starts its form on the tab, as Start Planning's Forms do (docs/specs/030-forms/forms.md).
  startForm?: (starter: StarterId) => void;
}) {
  const {
    activeId,
    tabs,
    selfParticipant,
    documentName,
    nameDocument,
    getViewportCenter,
    commitTabs,
    confirmName,
    setSelectedId,
    setEditingId,
    setSelfParticipant,
    setIdentityPromptOpen,
    requestFit,
    putToolDown,
    markTabLoaded,
    bringCardTypes,
    seedCards,
    startForm,
  } = opts;

  // The visitor name prompt: Join keeps the name typed (or the one they had), Cancel the one they had.
  const confirmIdentity = (name: string) => {
    if (name && name !== selfParticipant.name) setSelfParticipant((p) => ({ ...p, name }));
    confirmName();
    setIdentityPromptOpen(false);
  };
  const cancelIdentity = () => {
    confirmName();
    setIdentityPromptOpen(false);
  };

  const chooseTemplate = async (kind: TemplateKind) => {
    // Applying a template REPLACES the tab's elements, and a start only shows on an empty tab, so a pick landing on a
    // tab with work on it (a collaborator drew first) touches nothing rather than wipe the tab.
    if ((tabs.find((t) => t.id === activeId)?.elements.length ?? 0) > 0) return;
    // Telemetry (docs/specs/017-telemetry/telemetry.md): a template was applied; `type` is the kind.
    track('Template', 'Used', titleCaseType(kind));
    // A start on a tab is the new-tab entry (docs/specs/023-draw-mode/draw-mode.md "Telemetry").
    if (kind === 'whiteboard') track('Draw', 'Created', 'NewTab');
    confirmName();
    // Dynamic-import the heavy builders module only when the user
    // actually picks a template. The ~1700 lines of build* code stays
    // out of the editor's initial chunk; returning users opening an
    // existing document never download it.
    const {
      templateTabs,
      templateCanvasOverrides,
      isDefaultDocumentName,
      untitledNameForTemplate,
    } = await import('@/lib/template-builders');
    // The first tab's template names a document still on a default name ("Untitled Flowchart",
    // docs/specs/007-editor/templates-by-mode.md "The document's name"); a name someone gave it stays.
    if (tabs[0]?.id === activeId && isDefaultDocumentName(documentName)) {
      const named = untitledNameForTemplate(kind);
      if (named !== documentName) nameDocument(named);
    }
    // A form template: the tab becomes its form, its board or sheet made as Start Planning makes them.
    if (isFormTemplateKind(kind) && startForm) {
      startForm(formTemplateStarter(kind));
      return;
    }
    const centre = getViewportCenter();
    // A template may make several tabs (docs/specs/026-plan/plan-templates.md): the first lands here.
    const [first, ...rest] = templateTabs(kind);
    const rawElements = first!.build(centre.x, centre.y);
    // Painted in the tab's own theme: a start picks no theme, so the template lands in the colours the tab already
    // wears (docs/specs/007-editor/start-diagramming.md "The panel"), and the tab's backdrop is left as it is. Sticky
    // notes keep their own colour, as `addBoxed` does; multi-colour themes tint each branch a different hue
    // (recolourElementsForTheme, docs/specs/011-theme/multicolour-themes.md), the same helper /new's create uses.
    const theme = getTheme(tabs.find((t) => t.id === activeId)?.theme);
    const elements = recolourElementsForTheme(rawElements, theme);
    const overrides = templateCanvasOverrides(kind);
    const opensIn = templateOpensIn(overrides);
    // The template's later tabs: built at the origin (a fresh tab frames itself), recoloured as the
    // first, named by the template.
    // Every tab's id in order: a Plan template's tabs name each other (a Dashboard's slots, plan-tabs.md).
    const ids = [activeId, ...rest.map(() => crypto.randomUUID())];
    const followers = rest.map((def, i) => {
      const raw = def.build(0, 0);
      return {
        id: ids[i + 1]!,
        name: def.name ?? '',
        elements: recolourElementsForTheme(raw, theme),
        ...(def.tab ? { fields: def.tab(ids) } : {}),
        // A companion Sheet wears the theme's backdrop, not the drawing's pattern (template-companions.ts).
        ...(def.ownCanvas
          ? {
              ownCanvas: {
                backgroundPattern: theme.backgroundPattern,
                patternColor: theme.patternColor,
                ...(theme.backgroundOpacity != null
                  ? { backgroundOpacity: theme.backgroundOpacity }
                  : {}),
              },
            }
          : {}),
      };
    });
    // A Plan template's boards bring their card types, every tab's (docs/specs/026-plan/plan-templates.md "Card
    // types a template uses"), before the tabs land.
    bringCardTypes([...elements, ...followers.flatMap((f) => f.elements)]);
    // Re-checked inside the commit (landTemplateOnTab): the tab may have gained a collaborator's
    // element while the builders loaded, and the scaffold must never replace it.
    const firstKind = first!.tab?.(ids).kind;
    commitTabs((ts) =>
      landTemplateOnTab(ts, activeId, (active) => {
        const landed: Tab = {
          ...active,
          elements,
          templateChosen: true,
          // Any template but a blank one names the tab after itself (docs/specs/007-editor/templates-by-mode.md "The
          // tab's name"): its own name for the tab, else for a Board or Sheet template what fills it (the board's
          // title), else the template's title. A blank one leaves the name as it was.
          ...(first!.name
            ? { name: first!.name }
            : (() => {
                const name = templateTabName(kind, { ...active, elements, kind: firstKind });
                return name ? { name } : {};
              })()),
          ...overrides,
          ...(opensIn ? { opensIn } : {}),
          ...first!.tab?.(ids),
        };
        const withMode = { ...overrides, ...(opensIn ? { opensIn } : {}) };
        // A blank infographic's page starts on the theme's default background, as an added page.
        const themed = withBlankPageThemed(landed, kind, theme);
        return { landed: themed, followers: templateFollowerTabs(themed, followers, withMode) };
      }),
    );
    for (const f of followers) markTabLoaded(f.id);
    // A Plan template's boards open on its worked example (docs/specs/026-plan/plan-templates.md "Example cards").
    if (isPlanTemplateKind(kind)) {
      const { planTemplateSeedItems, seedToday } =
        await import('@livedesign/templates/plan-template-seeds');
      const seeds = planTemplateSeedItems(kind, seedToday());
      if (seeds.length) seedCards(seeds);
    }
    // The scaffold replaced the tab's content, so frame it. Blank leaves the view where it is.
    // It also turns the tab into one with content, which opens on Select: a pen picked up for the empty tab is
    // put down, so its style panel doesn't sit over the board and the first click selects.
    if (elements.length > 0) {
      requestFit();
      putToolDown();
    }
    // Auto-select when a template produces a single element so the user can
    // immediately rename or edit it. Multi-element templates — and the now
    // truly-empty Blank template (zero elements) — leave the selection cleared.
    setSelectedId(elements.length === 1 ? elements[0]!.id : null);
    setEditingId(null);
  };

  return { chooseTemplate, confirmIdentity, cancelIdentity };
}
