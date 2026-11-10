import { useDeckFollowsPages } from '../useDeckFollowsPages';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import { useKeyboardAvoidance } from '@liveworkspace/workbench/hooks/canvas/useKeyboardAvoidance';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useEffectEvent } from 'react';
import { resolveSlide, slideFrame } from '@livedocuments/document';
import { useFollowMe } from '@/hooks/collab/useFollowMe';
import { useShowFollowersMyView } from '@liveworkspace/workbench/hooks/collab/useShowFollowersMyView';
import { commitUserPreferences } from '@/lib/user-preferences';
import { useEditorViewport as useViewportState } from '@/hooks/canvas/useEditorViewport';
import { useSlideDeck } from '../useSlideDeck';
import { deckSaveQueue, type DeckSaveQueue } from '../deck-save';
import { slideFitOptions } from '@/lib/presentation-config';
import { useCanvasPinchZoom } from '@/hooks/canvas/useCanvasPinchZoom';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { apiSaveDocumentMeta } from '@/lib/api-client';
import { useTabEntryEffects } from '../useTabEntryEffects';
import { useCollabDeepLinkCapture } from '../useCollabDeepLink';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { boundsOfElements } from '@/lib/changeset-reveals';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';
import type { EditorPersistence } from './useEditorPersistence';
import type { EditorCollaboration } from './useEditorCollaboration';

// The view: the viewport (pan, zoom, fit) and keyboard avoidance, the slide deck and everything presenting does to
// the view (capture, frame, refit, restore), publishing and following viewports, the changeset reveal, pinch zoom,
// the Inbox deep-link capture and the tab-entry fit.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorViewport({
  documentSlice,
  selectionSlice,
  sessionSlice,
  persistenceSlice,
  collaborationSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
  persistenceSlice: EditorPersistence;
  collaborationSlice: EditorCollaboration;
}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const { tabs } = documentSlice;
  const { activeId, setActiveId, readSelection, setSelectedId, setMultiSelectedIds } =
    selectionSlice;
  const {
    selfParticipant,
    shortcutsEnabled,
    roomRef,
    sharePasswordGate,
    sessionShareCode,
    userPreferences,
    setUserPreferences,
    toast,
    documentPresentation,
    setDocumentPresentation,
    livePresence,
    remoteViewports,
    followerIds,
    followingRef,
    loadedTabIds,
    documentId,
    hydrated,
    isReadOnly,
  } = sessionSlice;
  const { tabsRef } = persistenceSlice;
  const { revealChangesetRef, activeTab, broadcastViewport } = collaborationSlice;
  const {
    viewport,
    setViewportOffset,
    setViewportZoom,
    zoomRef,
    viewportOffsetRef,
    canvasMainRef,
    getViewportCenter,
    getViewportCanvasRect,
    fitToScreen,
    fitToBounds,
    scrollIntoView,
  } = useViewportState({ activeTab, readSelection });
  // A phone's keyboard never hides the caret on the canvas (useKeyboardAvoidance).
  useKeyboardAvoidance({ canvasMainRef, zoomRef, setViewportOffset });

  // Slide deck (docs/specs/012-collaboration/presentation-mode.md). Owns the deck, the panel's editing verbs, and the
  // presentation Start runs. Placed after the viewport because presenting
  // frames each slide through it.
  // The deck as this editor last stored or loaded it: what its next deck save is built on.
  const deckBaseRef = useRef<string | null>(documentPresentation);
  // The deck this editor last sent: coming back through documentPresentation it is no new base (the save queue moves
  // the base itself, once the save lands).
  const sentDeckRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (documentPresentation !== sentDeckRef.current) deckBaseRef.current = documentPresentation;
  }, [documentPresentation]);
  // Deck saves one at a time, each built on the outcome of the one before (deck-save.ts); made on the first save.
  const toastRef = useLatest(toast);
  const deckSavesRef = useRef<DeckSaveQueue | null>(null);
  const slideDeck = useSlideDeck({
    prefs: userPreferences,
    // Built on this render's preferences: moved onto the freshest before the whole blob is written.
    commitPrefs: (next) =>
      setUserPreferences(commitUserPreferences(userPreferences, next, selfParticipant.id)),
    tabs,
    activeTabId: activeId,
    setSelectedId,
    setMultiSelectedIds,
    isReadOnly,
    saveDeck: (serialised, opts) => {
      if (!hydrated || !documentId) return;
      sentDeckRef.current = serialised;
      setDocumentPresentation(serialised);
      deckSavesRef.current ??= deckSaveQueue(deckBaseRef, (message) =>
        toastRef.current.error(message),
      );
      deckSavesRef.current.save(
        serialised,
        (presentationBase) =>
          apiSaveDocumentMeta(
            selfParticipant.id,
            { id: documentId, presentation: serialised, presentationBase },
            sessionShareCode,
            opts,
          ),
        opts,
      );
    },
  });
  // Seed the deck once the document's stored blob arrives. Triggered only when a stored deck appears or
  // the document changes: hydrating on every deck edit would fight the editing verbs, so the blob itself
  // is read at that moment (an effect event), not depended on.
  const hydrateStoredDeck = useEffectEvent(() => slideDeck.hydrateDeck(documentPresentation));
  const hasStoredDeck = documentPresentation !== null;
  useEffect(() => {
    hydrateStoredDeck();
  }, [hasStoredDeck, documentId]);
  // After the hydration above, so the stored deck is what the deck's follow pass builds on.
  useDeckFollowsPages({
    tabs,
    ready: hydrated,
    hasStoredDeck,
    documentId,
    followPages: slideDeck.followPages,
  });

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
  // A page slide frames to its page; any other to what it shows (slideFrame).
  const frameSlide = useEffectEvent(() => {
    if (!presentingStep) return;
    const bounds = slideFrame(presentingStep.slide, presentingStep.tab);
    if (bounds) fitToBounds(bounds, slideFitOptions(presentingStep.slide, slideDeck.config));
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
    if (bounds) fitToBounds(bounds, slideFitOptions(presentingStep.slide, slideDeck.config));
  });
  useEffect(() => {
    const node = canvasMainRef.current;
    if (!presenting || !node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => refitSlide());
    observer.observe(node);
    return () => observer.disconnect();
  }, [presenting, canvasMainRef]);

  // Publish where WE are looking, on change (docs/specs/012-collaboration/follow-me-viewport.md). Unsolicited by design
  // — see the RoomOp comment — and throttled to ~10 Hz inside the broadcaster,
  // so an idle participant sends nothing at all.
  // `broadcastViewport` is re-created every render, so it is called through an effect event. It follows
  // the viewport store (a pan or zoom renders no part of the editor) and sends again on a tab switch.
  const publishViewNow = () => {
    const view = viewport.get();
    const node = canvasMainRef.current;
    broadcastViewport(view.offset, view.zoom, {
      width: node?.offsetWidth ?? 0,
      height: node?.offsetHeight ?? 0,
    });
  };
  const publishViewport = useEffectEvent(publishViewNow);
  useEffect(() => {
    publishViewport();
    return viewport.subscribe(publishViewport);
  }, [viewport, activeId]);
  // A new follower is shown our view at once, not at our next pan.
  useShowFollowersMyView(followerIds, publishViewNow);

  // Follow-me viewport (docs/specs/012-collaboration/follow-me-viewport.md): pin our pan / zoom / tab to a peer's until
  // we take the canvas back. View-role visitors can both follow and be
  // followed — it mutates nothing, and the audience on a view link is exactly
  // who most needs it.
  const followMe = useFollowMe({
    remoteViewports,
    livePresenceIds: livePresence.map((p) => p.id),
    activeId,
    viewport,
    onFollowTab: setActiveId,
    onNotice: (message) => toast.info(message),
    followerIds,
    nameOf: (id) => livePresence.find((p) => p.id === id)?.name ?? 'Someone',
    sendFollow: (target) => roomRef.current?.send({ kind: 'op', op: { kind: 'follow', target } }),
  });
  useAssignRef(followingRef, followMe.followingId);

  // A tab we are about to land on already aimed, so the tab-entry
  // fit-to-screen below leaves it alone (it runs a frame later and would
  // otherwise snap the view straight back off the element).
  const skipTabFitRef = useRef<string | null>(null);

  // The toast's Show (docs/specs/024-agents/agent-changesets.md "In the editor", CS34): the tab, then
  // every element the changeset touched that is still there, framed no closer than 100%.
  useAssignRef(revealChangesetRef, (tabId: string, ids: readonly string[]) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    const bounds = tab ? boundsOfElements(tab.elements, ids) : null;
    if (!bounds) return;
    if (tabId !== activeId) {
      skipTabFitRef.current = tabId;
      setActiveId(tabId);
    }
    fitToBounds(bounds, { maxZoom: 1 });
  });
  // Server capabilities (GET /api/capabilities). Fetched once at mount.
  const { emailEnabled } = useCapabilities(sharePasswordGate === null);

  // Pinch-to-zoom on touch screens + trackpad pinch (Ctrl+wheel).
  // Whether the tab's pages stand as a stack (set once pagesMode is known, below): a wheel then pans no sideways.
  const stackedRef = useRef(false);
  const { isPinchingRef } = useCanvasPinchZoom({
    canvasMainRef,
    viewport,
    stacked: () => stackedRef.current,
  });

  // Capture an Inbox element deep link BEFORE the tab-entry
  // effect below rewrites the hash to the plain #t= pin (docs/specs/013-workspace/inbox.md §1).
  // Consumed further down by useCollabDeepLink once the tab is ready.
  const collabDeepLink = useCollabDeepLinkCapture();

  // Tab-entry side effects (URL #t= pin + fit-to-screen once per tab
  // entry). See useTabEntryEffects. A tab showing pages frames the page you were
  // last on (else its first) instead (set by usePagesMode below), never the whole row.
  const frameFirstPageRef = useRef<(() => void) | null>(null);
  const { requestFit } = useTabEntryEffects({
    hydrated,
    activeId,
    elementCount: activeTab.elements.length,
    tabLoaded: loadedTabIds.has(activeId),
    fitToScreen: () => {
      (frameFirstPageRef.current ?? fitToScreen)();
    },
    skipFitForTabRef: skipTabFitRef,
  });

  return {
    viewport,
    setViewportOffset,
    setViewportZoom,
    zoomRef,
    viewportOffsetRef,
    canvasMainRef,
    getViewportCenter,
    getViewportCanvasRect,
    fitToScreen,
    scrollIntoView,
    slideDeck,
    presentingStep,
    presentingElements,
    presenting,
    keyboardEnabled,
    followMe,
    skipTabFitRef,
    emailEnabled,
    stackedRef,
    isPinchingRef,
    collabDeepLink,
    frameFirstPageRef,
    requestFit,
  };
}

export type EditorViewport = ReturnType<typeof useEditorViewport>;
