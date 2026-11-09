'use client';

import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useEffectEvent } from 'react';
import { resolveSlide, slideFrame } from '@livediagram/document';
import { commitUserPreferences } from '@/lib/user-preferences';
import { useSlideDeck } from '../useSlideDeck';
import { slideFitOptions } from '@/lib/presentation-config';
import { apiSaveDocumentMeta } from '@/lib/api-client';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorViewportSlice } from './useEditorViewport';

// The slide deck and a running presentation: the slide's elements, its framing, and the view put back on exit. A
// slice of useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own,
// with `view`, its part of the editor's view-model.
export function useEditorPresentation({
  fromDocument,
  fromHistory,
  fromSelection,
  fromDialogs,
  fromTools,
  fromCollaboration,
  fromPersistence,
  fromRoom,
  fromViewport,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromDialogs: EditorDialogsSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromRoom: EditorRoomSlice;
  fromViewport: EditorViewportSlice;
}) {
  const { documentId, hydrated, selfParticipant } = fromDocument;
  const { tabs } = fromHistory;
  const { activeId, readSelection, setActiveId, setMultiSelectedIds, setSelectedId } =
    fromSelection;
  const { panelLayout } = fromDialogs;
  const { shortcutsEnabled } = fromTools;
  const { isReadOnly, sessionShareCode } = fromCollaboration;
  const { documentPresentation, setDocumentPresentation, setUserPreferences, userPreferences } =
    fromPersistence;
  const { loadAllTabs } = fromRoom;
  const { canvasMainRef, fitToBounds, viewport } = fromViewport;

  // Slide deck (docs/specs/012-collaboration/presentation-mode.md). Owns the deck, the panel's editing verbs, and the
  // presentation Start runs. Placed after the viewport because presenting
  // frames each slide through it.
  const slideDeck = useSlideDeck({
    prefs: userPreferences,
    // Built on this render's preferences: moved onto the freshest before the whole blob is written.
    commitPrefs: (next) =>
      setUserPreferences(commitUserPreferences(userPreferences, next, selfParticipant.id)),
    tabs,
    activeTabId: activeId,
    setActiveId,
    readSelection,
    setSelectedId,
    setMultiSelectedIds,
    isReadOnly,
    saveDeck: (serialised) => {
      if (!hydrated || !documentId) return;
      setDocumentPresentation(serialised);
      void apiSaveDocumentMeta(
        selfParticipant.id,
        { id: documentId, presentation: serialised },
        sessionShareCode,
      ).catch(() => {
        // Best-effort, like every other metadata write: the deck is in
        // state either way and the next edit retries.
      });
    },
    loadAllTabs,
  });
  // Seed the deck once the document's stored blob arrives. Triggered only when a stored deck appears or
  // the document changes: hydrating on every deck edit would fight the editing verbs, so the blob itself
  // is read at that moment (an effect event), not depended on.
  const hydrateStoredDeck = useEffectEvent(() => slideDeck.hydrateDeck(documentPresentation));
  const hasStoredDeck = documentPresentation !== null;
  useEffect(() => {
    hydrateStoredDeck();
  }, [hasStoredDeck, documentId]);

  // What the presentation is showing right now, if anything.
  const presentingStep =
    slideDeck.presentingAt !== null ? slideDeck.runnable[slideDeck.presentingAt] : undefined;
  // The slide's elements, resolved fresh every render so an edit landing
  // underneath a presentation shows through (references, never copies).
  const presentingElements = useMemo(
    () => (presentingStep ? resolveSlide(presentingStep.slide, presentingStep.tab) : null),
    [presentingStep],
  );

  // Where the editor was looking before the deck took over, so exiting puts it
  // back. Without this you left a presentation zoomed to whatever the last
  // slide needed — often 250% on one box — and had to hunt around the canvas.
  const [preShowView, setPreShowView] = useState<{ tabId: string } | null>(null);
  const presenting = slideDeck.presentingAt !== null;
  // Captured on the way in, restored on the way out: state adjusted during render on the transition
  // (docs/specs/003-system-architecture/react-state-and-effects.md), so the restore lands in the same
  // commit as the exit instead of one frame later.
  const [wasPresenting, setWasPresenting] = useState(presenting);
  if (presenting !== wasPresenting) {
    setWasPresenting(presenting);
    if (presenting) {
      setPreShowView({ tabId: activeId });
    } else if (preShowView) {
      setPreShowView(null);
      setActiveId(preShowView.tabId);
    }
  }
  // The view itself (it lives in the viewport store, docs/specs/008-canvas/blueprints/viewport-store.md,
  // never written during render) is captured as a deck starts and put back as it ends, in a layout
  // effect: before the exit paints, and declared before the slide fit below, so the capture is the
  // view from before the first slide was framed.
  const viewBeforeShow = useRef<View | null>(null);
  useLayoutEffect(() => {
    if (presenting) {
      viewBeforeShow.current = viewport.get();
      return;
    }
    if (viewBeforeShow.current) {
      viewport.setView(viewBeforeShow.current);
      viewBeforeShow.current = null;
    }
  }, [presenting, viewport]);
  // Every editor keyboard surface is off while a deck is running (docs/specs/012-collaboration/presentation-mode.md).
  // The overlay owns the keyboard then — it consumes the keys it uses, but
  // everything else fell straight through to the editor, so pressing G in
  // front of a room armed a parallelogram on a canvas you cannot draw on.
  // Gated here rather than by swallowing keys in the overlay: this is the
  // switch the shortcut hooks already have, and it covers a surface added
  // later without anybody remembering to.
  const keyboardEnabled = shortcutsEnabled && !presenting;
  // Presenting moves the editor to the slide's tab and frames the slide. Both
  // are ordinary view state, and the effect above puts them back on exit.
  //
  // A LAYOUT effect, not an ordinary one: the canvas has already been handed
  // the new slide's elements by the time this runs, so fitting after paint
  // showed one frame of the new content under the OLD slide's camera. That is
  // the flash of "small in the corner" a deferred fit produces.
  const presentingSlideId = presentingStep?.slide.id;
  const presentingTabId = presentingStep?.tab.id;
  const [framedSlideId, setFramedSlideId] = useState(presentingSlideId);
  if (presentingSlideId !== framedSlideId) {
    setFramedSlideId(presentingSlideId);
    if (presentingTabId !== undefined && presentingTabId !== activeId) setActiveId(presentingTabId);
  }
  // A slide fills the screen by default. The editor's own fit caps at 100%
  // because a sparse canvas blown up looks broken in a workspace; a slide is
  // the only thing on a projector, so a one-box slide SHOULD be a big box —
  // unless the presenter has picked "Actual size" from the cog.
  // A slide frames to what it shows (slideFrame).
  const frameSlide = useEffectEvent(() => {
    if (!presentingStep) return;
    const bounds = slideFrame(presentingStep.slide, presentingStep.tab);
    if (bounds) fitToBounds(bounds, slideFitOptions(slideDeck.config));
  });
  const slideZoom = slideDeck.config.zoom;
  useLayoutEffect(() => {
    if (presentingElements) frameSlide();
  }, [presentingSlideId, presentingElements, slideZoom]);

  // ...and fit again whenever the canvas CHANGES SIZE while presenting.
  //
  // Entering a presentation changes the size of the very box the fit measures,
  // and all of it lands after the effect above: the browser goes fullscreen,
  // and the header and tab bar leave with the zen treatment. Fitting against
  // the pre-presentation rect centred slide one on a viewport that no longer
  // existed by the time it painted, so it arrived shoved into a corner with
  // its top clipped.
  //
  // A ResizeObserver rather than a window `resize` listener, because hiding
  // the chrome changes the canvas's height without the WINDOW changing size at
  // all. This covers that, fullscreen arriving late, fullscreen being refused,
  // an ordinary resize, and a phone rotating.
  const refitSlide = useEffectEvent(() => {
    if (!presentingStep) return;
    const bounds = slideFrame(presentingStep.slide, presentingStep.tab);
    if (bounds) fitToBounds(bounds, slideFitOptions(slideDeck.config));
  });
  useEffect(() => {
    const node = canvasMainRef.current;
    if (!presenting || !node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => refitSlide());
    observer.observe(node);
    return () => observer.disconnect();
  }, [presenting, canvasMainRef]);
  return {
    keyboardEnabled,
    presenting,
    view: {
      // Presenting wears the zen chrome treatment (docs/specs/012-collaboration/presentation-mode.md → docs/specs/007-editor/zen-mode.md): header,
      // tab bar, panels and palette all gone, so a projector shows the document
      // rather than the workbench. An OVERRIDE of the spread above rather than a
      // write to zen state, so exiting a presentation restores whatever zen the
      // user actually had.
      zenMode: panelLayout.zenMode || slideDeck.presentingAt !== null,
      // Slide deck (docs/specs/012-collaboration/presentation-mode.md): the whole surface in one object, like livePoll —
      // nothing outside the panel and the overlay reads into it.
      slideDeck,
      // What the presentation is showing, or null. The canvas renders THESE
      // instead of the tab's elements while it is non-null, which is what makes
      // a slide a slide.
      presentingElements,
    },
  };
}

export type EditorPresentationSlice = ReturnType<typeof useEditorPresentation>;
