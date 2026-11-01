import type { Dispatch, SetStateAction } from 'react';
import type { EditorMode, Tab } from '@livediagram/document';
import { track, titleCaseType } from '@/lib/telemetry';
import { getTheme, recolourElementsForTheme } from '@/lib/themes';
import type { TemplateKind } from '@livediagram/templates';
import { templateTabName } from '@/lib/template-tab-name';
import type { Participant } from '@/lib/identity';
import { landTemplateOnTab } from './template-tab-set';

type SetState<T> = Dispatch<SetStateAction<T>>;
// The mode a chosen template's tab opens in (docs/specs/007-editor/editor-modes.md "Where the
// mode lives"): the Whiteboard draws, every other template is a diagram, Blank included, even on
// a tab that opened in Draw. An event-storming board has no mode to give (it is always Diagram).
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
      buildTemplate,
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
    const centre = getViewportCenter();
    const rawElements = buildTemplate(kind, centre.x, centre.y);
    // Painted in the tab's own theme: a start picks no theme, so the template lands in the colours the tab already
    // wears (docs/specs/007-editor/start-diagramming.md "The panel"), and the tab's backdrop is left as it is. Sticky
    // notes keep their own colour, as `addBoxed` does; multi-colour themes tint each branch a different hue
    // (recolourElementsForTheme, docs/specs/011-theme/multicolour-themes.md), the same helper /new's create uses.
    const theme = getTheme(tabs.find((t) => t.id === activeId)?.theme);
    const elements = recolourElementsForTheme(rawElements, theme);
    const overrides = templateCanvasOverrides(kind);
    const opensIn = templateOpensIn(overrides);
    // Re-checked inside the commit (landTemplateOnTab): the tab may have gained a collaborator's
    // element while the builders loaded, and the scaffold must never replace it.
    commitTabs((ts) =>
      landTemplateOnTab(ts, activeId, (active) => {
        // Any template but a blank one names the tab after itself (docs/specs/007-editor/templates-by-mode.md "The
        // tab's name"); a blank one leaves the name as it was.
        const name = templateTabName(kind);
        return {
          ...active,
          elements,
          templateChosen: true,
          ...(name ? { name } : {}),
          ...overrides,
          ...(opensIn ? { opensIn } : {}),
        };
      }),
    );
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
