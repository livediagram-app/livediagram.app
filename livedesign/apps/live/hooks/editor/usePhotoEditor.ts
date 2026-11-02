'use client';

// The editor's wiring for photo pages (docs/specs/031-photo/photo-pages.md), in one place so the
// editor's state hook composes it with a single call: the page in focus and its editing session (only
// it holds pixels), the session's commits as tab edits (one undo step each, a gesture's ticks under
// its checkpoint), the History, the previews made after commits, the blob store's transports, and the
// pages' view with `photo` in it.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  photoOfPage,
  photoPagesAdded,
  photosOf,
  withPhoto,
  type LaidOutPage,
  type Tab,
} from '@livedesign/design';
import { PHOTO_MAX_PAGES, PHOTO_PREVIEW_DELAY_MS, type Photo } from '@livedesign/photo-engine';
import type { MadeSize } from '@/lib/photo-editor/make-sizes';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import type { useToast } from '@/hooks/ui/useToast';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { PhotoBlobScope } from '@/lib/photo-editor/blob-client';
import type { ViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { photoFocusOf } from '@/lib/photo-editor/photo-focus';
import { PhotoHistory } from '@/lib/photo-editor/photo-history';
import type { PixelsStore } from '@/lib/photo-editor/pixels-store';
import { apiFetchImageBlob } from '@/lib/api/images';
import { PHOTO_PIXEL_ZOOM_MAX, raiseZoomCeiling, zoomCeilingRaised, zoomMax } from '@/lib/canvas';
import { track } from '@/lib/telemetry';
import type { PhotoSession } from '@/lib/photo-editor/session';
import type { PhotoRuntime } from '@/lib/photo-editor/runtime';
import { usePhotoFraming } from './usePhotoFraming';
import type { PhotoLayerPeer, PhotoPresence } from './usePhotoPresence';
import { photoTools } from '@/lib/photo-editor/tool-state';
import type { ToolCtx, ToolOverlay } from '@/lib/photo-editor/tools/tool-context';
import { apiTransport, photoUploads } from '@/lib/photo-editor/upload-queue';

type Rect = { x: number; y: number; width: number; height: number };

/** What a tool shows over the photo, kept outside React so a drag redraws only the overlay. */
export class OverlayStore {
  private value: ToolOverlay = { kind: 'none' };
  private readonly listeners = new Set<() => void>();
  get = (): ToolOverlay => this.value;
  set = (next: ToolOverlay): void => {
    this.value = next;
    for (const fn of this.listeners) fn();
  };
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
}

export type PhotoTextEdit = { layerId: string; isNew: boolean };

export type PhotoEditorView = {
  // The tab's photos by page (each page's preview), and the tab.
  photos: Readonly<Record<string, Photo>>;
  // Whether the tab has a photo page: until it does, none of the photo surfaces (or their code) load.
  hasPhotoPage: boolean;
  tabId: string;
  // The photo page in focus, and its session once its photo is in hand.
  focusId: string | null;
  session: PhotoSession | null;
  // Raised on each change the session reports: what re-renders the panel.
  version: number;
  // An Editor on an unlocked tab; a Participant may look closer (photo-pages.md "Share roles").
  canEdit: boolean;
  canInspect: boolean;
  ctx: ToolCtx | null;
  overlay: OverlayStore;
  history: PhotoHistory;
  // The design timeline's depth now, and stepping it to a History entry.
  depth: number;
  stepHistory: (steps: number) => void;
  // A press on a photo page takes it into focus.
  press: (pageId: string) => void;
  // The text overlay's edit in hand.
  textEdit: PhotoTextEdit | null;
  endTextEdit: () => void;
  scope: PhotoBlobScope | null;
  store: PixelsStore | null;
  toast: (message: string) => void;
  // Writes a photo page's photo directly (a started photo, a placed PSD): one edit.
  writePhoto: (pageId: string, photo: Photo, label: string) => void;
  // Edit as Photo: a new photo page after the image's page, started from its picture. Absent where
  // the session may not add pages.
  editAsPhoto?: (imageId: string, from: { x: number; y: number }) => void;
  // Make Sizes' pages added after the source page, one edit, and the view taken to the first; false when
  // refused (no room). Absent where the session may not add pages (photo-pages.md "Making sizes").
  addSizes?: (sourceId: string, made: readonly MadeSize[]) => boolean;
  // How many more photo pages the tab takes.
  photoRoom: number;
  // All Sizes as PNGs with their elements (Make Sizes' toast); absent without a scope.
  exportAllSizes?: (designName: string) => Promise<void>;
  // Rasterize Into Layer: an element on the photo in focus drawn into a new layer and removed, one
  // edit. Absent where the session may not edit the photo.
  rasterizeElement?: (elementId: string) => void;
  // The photo editor's working parts once they have loaded (a tab with a photo page).
  runtime: PhotoRuntime | null;
  // The peers on a layer of the photo in focus, for its row's avatars.
  others: (layerId: string) => readonly PhotoLayerPeer[];
  // Fit Photo (the page in focus fills the view) and Actual Pixels (a screen px a photo px).
  fitPhoto: () => void;
  actualPixels: () => void;
};

export function usePhotoEditor<V extends PagesModeView>({
  pagesModeView,
  pages,
  activeTab,
  commitTabs,
  tickTabs,
  markCheckpoint,
  cancelToCheckpoint,
  undo,
  redo,
  depth,
  visibleRect,
  viewport,
  scope,
  canEdit,
  canInspect,
  presence,
  toast,
}: {
  pagesModeView: V | null;
  pages: readonly LaidOutPage[] | null;
  activeTab: Tab;
  commitTabs: (map: (tabs: Tab[]) => Tab[]) => void;
  tickTabs: (map: (tabs: Tab[]) => Tab[]) => void;
  markCheckpoint: () => void;
  cancelToCheckpoint: () => void;
  undo: () => void;
  redo: () => void;
  depth: number;
  // The canvas rect in view now, and the view's store (its moves).
  visibleRect: () => Rect | null;
  viewport: ViewportStore;
  scope: PhotoBlobScope | null;
  canEdit: boolean;
  canInspect: boolean;
  // Who is on which layer (docs/specs/031-photo/photo-pages.md "Collaboration").
  presence: PhotoPresence;
  toast: ReturnType<typeof useToast>;
}) {
  const tabId = activeTab.id;
  const scopeRef = useLatest(scope);
  // The blob store's transports, set once a scope is known: the uploads go with the identity now.
  const ready = scope !== null;
  useEffect(() => {
    if (!ready) return;
    photoUploads.setTransport(apiTransport(() => scopeRef.current!));
    return () => photoUploads.setTransport(null);
  }, [ready, scopeRef]);
  // The working parts arrive once the tab has a photo page (runtime.ts): a design without one never
  // downloads the pixel engine.
  const hasPhotoPage = !!pages?.some((p) => p.kind === 'photo');
  const [rt, setRt] = useState<PhotoRuntime | null>(null);
  useEffect(() => {
    if (!hasPhotoPage || rt) return;
    let live = true;
    void import('@/lib/photo-editor/runtime').then((m) => {
      if (live) setRt(m);
    });
    return () => {
      live = false;
    };
  }, [hasPhotoPage, rt]);
  const store = useMemo(
    () => (ready && rt ? new rt.PixelsStore(rt.apiFetcher(() => scopeRef.current!)) : null),
    [ready, rt, scopeRef],
  );
  useEffect(() => () => store?.clear(), [store]);

  // Focus: the page pressed while in view, else the photo page taking the most of the view. Worked
  // out as the view moves (a few pages: cheap), a render only when it changes.
  const [pressed, setPressed] = useState<string | null>(null);
  const focusId = useSyncExternalStore(
    viewport.subscribe,
    () => (pages ? photoFocusOf(pages, visibleRect(), pressed) : null),
    () => null,
  );

  const history = useMemo(() => new PhotoHistory(), []);
  const depthRef = useLatest(depth);
  const overlay = useMemo(() => new OverlayStore(), []);
  const [textEdit, setTextEdit] = useState<PhotoTextEdit | null>(null);
  // The checkpoint a gesture's steps sit under, and its History entry's depth.
  const gestureDepth = useRef<number | null>(null);
  const toastRef = useLatest(toast);

  const writeTab = useCallback(
    (pageId: string, photo: Photo, undoable: boolean) => {
      const map = (ts: Tab[]) => ts.map((t) => (t.id === tabId ? withPhoto(t, pageId, photo) : t));
      if (undoable) commitTabs(map);
      else tickTabs(map);
    },
    [tabId, commitTabs, tickTabs],
  );
  const writeTabRef = useLatest(writeTab);

  // The session for the page in focus; disposed (its commits finished) when focus moves on.
  const [session, setSession] = useState<PhotoSession | null>(null);
  const tabRef = useLatest(activeTab);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!focusId || !store || !rt) {
      setSession(null);
      return;
    }
    const pageId = focusId;
    let previewRun = 0;
    const s: PhotoSession = new rt.PhotoSession(photoOfPage(tabRef.current, pageId), {
      tabId,
      pageId,
      store,
      enqueue: (t, entries) => photoUploads.enqueue(t, entries),
      commit: (photo, label, opts) => {
        const undoable = opts?.undoable !== false;
        writeTabRef.current(pageId, photo, undoable && gestureDepth.current === null);
        if (label === 'Preview') return;
        rt.announceCommit(label, s);
        if (gestureDepth.current !== null) history.record(label, pageId, gestureDepth.current);
        else if (undoable) history.record(label, pageId, depthRef.current + 1);
        // A moment after the last commit, the preview is made again.
        if (previewTimer.current) clearTimeout(previewTimer.current);
        const run = ++previewRun;
        previewTimer.current = setTimeout(() => {
          void (async () => {
            const r = await rt.previewRaster(s.photo, s.lookup(), () => run !== previewRun);
            if (!r || run !== previewRun) return;
            const entry = await rt.encodePreview(r);
            if (!entry || run !== previewRun) return;
            store.put(
              entry.id,
              r.data,
              new Blob([entry.bytes as Uint8Array<ArrayBuffer>], { type: entry.type }),
            );
            photoUploads.enqueue(tabId, [entry]);
            s.commitStack({ ...s.photo, preview: entry.id }, 'Preview', { undoable: false });
          })();
        }, PHOTO_PREVIEW_DELAY_MS);
      },
      checkpoint: () => {
        markCheckpoint();
        gestureDepth.current = depthRef.current + 1;
      },
      cancelCheckpoint: () => {
        if (gestureDepth.current !== null) history.drop(gestureDepth.current);
        gestureDepth.current = null;
        cancelToCheckpoint();
      },
      endCheckpoint: () => {
        gestureDepth.current = null;
      },
    });
    setSession(s);
    const offSelection = rt.watchSelection(s);
    return () => {
      offSelection();
      previewRun++;
      if (previewTimer.current) clearTimeout(previewTimer.current);
      setSession(null);
      void s.settled().then(() => s.dispose());
    };
    // A new session per page in focus (and per tab); the tab's photo reaches it below.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [focusId, tabId, store, rt]);

  const focusPage = pagesModeView?.focusPage;
  usePhotoFraming(session?.pageId ?? null, focusPage, canEdit, canInspect);

  // The zoom ceiling raised while a photo page is in focus, so its pixels can be worked one by one
  // (lib/canvas.ts zoomMax); back down after, the view brought within it.
  const focusPageRect = focusId ? pages?.find((p) => p.id === focusId)?.rect : undefined;
  const focusPhotoWidth = focusId ? activeTab.photos?.[focusId]?.width : undefined;
  const perPhotoPx =
    focusPageRect && focusPhotoWidth ? focusPhotoWidth / focusPageRect.width : null;
  useEffect(() => {
    if (perPhotoPx === null) return;
    raiseZoomCeiling(PHOTO_PIXEL_ZOOM_MAX * perPhotoPx);
    return () => {
      raiseZoomCeiling(null);
      // Another photo page taking focus raises it again first.
      queueMicrotask(() => {
        if (!zoomCeilingRaised() && viewport.get().zoom > zoomMax()) viewport.setZoom(zoomMax());
      });
    };
  }, [perPhotoPx, viewport]);
  const fitPhoto = useCallback(() => {
    if (focusId) focusPage?.(focusId);
  }, [focusId, focusPage]);
  const actualPixels = useCallback(() => {
    // On the centred view a zoom keeps the view's centre where it is.
    if (perPhotoPx !== null) viewport.setZoom(Math.min(zoomMax(), perPhotoPx));
  }, [perPhotoPx, viewport]);

  // The tab's photo for the page in focus, as it changes (a peer's ops, an undo): into the session.
  const tabPhoto = focusId ? activeTab.photos?.[focusId] : undefined;
  useEffect(() => {
    if (session && tabPhoto) session.setPhoto(photoOfPage(activeTab, session.pageId));
    // Only the photo's own change matters.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [session, tabPhoto]);

  // The session's changes re-render what reads it (the panel, the rail).
  const version = useSyncExternalStore(
    useCallback((fn: () => void) => session?.subscribe(fn) ?? (() => {}), [session]),
    () => session?.version ?? 0,
    () => 0,
  );

  const ctx = useMemo<ToolCtx | null>(
    () =>
      session
        ? {
            session,
            state: photoTools.get,
            // A tool's toasts are refusals (a locked layer, nothing selected): shown even with notifications
            // off, or the press would seem to do nothing.
            toast: (m) => toastRef.current.warning(m),
            offer: (message, actions) =>
              toastRef.current.action({
                key: 'photo-tool-offer',
                message,
                important: true,
                actions: actions.map((a) => ({ label: a.label, onSelect: a.run })),
              }),
            setOverlay: overlay.set,
            editText: (layerId, isNew = false) => setTextEdit({ layerId, isNew }),
          }
        : null,
    [session, overlay, toastRef],
  );

  const endTextEdit = useCallback(() => setTextEdit(null), []);

  const stepHistory = useCallback(
    (steps: number) => {
      for (let i = 0; i < -steps; i++) undo();
      for (let i = 0; i < steps; i++) redo();
    },
    [undo, redo],
  );

  const writePhoto = useCallback(
    (pageId: string, photo: Photo, label: string) => {
      writeTab(pageId, photo, true);
      history.record(label, pageId, depthRef.current + 1);
    },
    [writeTab, history, depthRef],
  );

  const photos = useMemo(
    () => photosOf(activeTab),
    // The photos alone matter.
    // oxlint-disable-next-line react/exhaustive-deps
    [activeTab.photos],
  );
  // Edit as Photo: the new page's picture, put in once that page's session is in hand.
  const pendingStart = useRef<{ pageId: string; blob: Promise<Blob | null> } | null>(null);
  useEffect(() => {
    const p = pendingStart.current;
    if (!p || !session || !rt || session.pageId !== p.pageId) return;
    pendingStart.current = null;
    void p.blob.then(async (blob) => {
      if (!blob) return toastRef.current.warning('That picture could not be opened.');
      const read = await rt.readPicture(blob);
      if (read.kind === 'refused') return toastRef.current.warning(read.reason);
      if (read.kind === 'psd') return rt.startFromPsd(session, read);
      await rt.startFromPicture(session, read.picture);
    });
  }, [session, toastRef, rt]);
  const addPhotoPage = pagesModeView?.edit?.addPhotoPage;
  const editAsPhoto = useMemo(
    () =>
      addPhotoPage && scope && canEdit
        ? (imageId: string, from: { x: number; y: number }) => {
            const on = pages?.find(
              (p) =>
                from.x >= p.rect.x &&
                from.x < p.rect.x + p.rect.width &&
                from.y >= p.rect.y &&
                from.y < p.rect.y + p.rect.height,
            );
            const pageId = addPhotoPage(on?.id ?? pages?.at(-1)?.id ?? null);
            if (!pageId) return;
            track('Tab', 'Changed', 'PhotoEditAsPhoto');
            pendingStart.current = {
              pageId,
              blob: apiFetchImageBlob(scope.ownerId, imageId, {
                designId: scope.designId,
                shareCode: scope.shareCode,
              }),
            };
            setPressed(pageId);
          }
        : undefined,
    [addPhotoPage, scope, canEdit, pages],
  );

  // Make Sizes (photo-pages.md "Making sizes"): the new pages in one edit, the view gone to the first
  // once it is laid out.
  const photoRoom = Math.max(
    0,
    PHOTO_MAX_PAGES - (pages?.filter((p) => p.kind === 'photo').length ?? 0),
  );
  const [sizesGoTo, setSizesGoTo] = useState<string | null>(null);
  useEffect(() => {
    if (!sizesGoTo || !pages?.some((p) => p.id === sizesGoTo)) return;
    setSizesGoTo(null);
    focusPage?.(sizesGoTo);
    setPressed(sizesGoTo);
  }, [sizesGoTo, pages, focusPage]);
  const addSizes = useMemo(
    () =>
      addPhotoPage && canEdit
        ? (sourceId: string, made: readonly MadeSize[]): boolean => {
            const out = photoPagesAdded(tabRef.current, sourceId, made);
            if (!('tab' in out) || !made.length) return false;
            commitTabs((ts) =>
              ts.map((t) => {
                if (t.id !== tabId) return t;
                const again = photoPagesAdded(t, sourceId, made);
                return 'tab' in again ? again.tab : t;
              }),
            );
            setSizesGoTo(made[0]!.id);
            track('Tab', 'Changed', 'PhotoMakeSizes');
            return true;
          }
        : undefined,
    [addPhotoPage, canEdit, tabRef, commitTabs, tabId],
  );
  const pagesRef = useLatest(pages);
  const sessionRef = useLatest(session);
  const exportAllSizes = useMemo(
    () =>
      scope && store && rt
        ? async (designName: string) => {
            const file = await rt.allSizesZip(
              tabRef.current,
              pagesRef.current ?? [],
              store,
              sessionRef.current,
              designName,
              { format: 'png', quality: 0.9, matte: '#ffffff', withElements: true, scope },
            );
            rt.download(file.blob, file.name);
            track('Document', 'Exported', 'PhotoAllSizes');
          }
        : undefined,
    [scope, store, rt, tabRef, pagesRef, sessionRef],
  );

  const tabForRaster = useLatest(activeTab);
  const rasterizeElement = useMemo(
    () =>
      session && canEdit && rt
        ? (elementId: string) => {
            const tab = tabForRaster.current;
            const el = tab.elements.find((e) => e.id === elementId);
            const page = pages?.find((p) => p.id === session.pageId);
            if (!el || !page) return;
            void (async () => {
              const px = await rt.elementPixels(tab, el, page, session.photo).catch(() => null);
              if (!px) return toastRef.current.warning('That element lies off the photo.');
              // The new layer and the element gone: one step.
              session.checkpoint();
              rt.placePicture(
                session,
                px.raster,
                'Layer',
                { x: px.x, y: px.y },
                'Rasterize Into Layer',
              );
              tickTabs((ts) =>
                ts.map((t) =>
                  t.id === tab.id
                    ? { ...t, elements: t.elements.filter((e) => e.id !== elementId) }
                    : t,
                ),
              );
              await session.settled();
              session.endGesture();
              track('Element', 'Changed', 'PhotoRasterizeIntoLayer');
            })();
          }
        : undefined,
    [session, canEdit, rt, pages, tabForRaster, tickTabs, toastRef],
  );

  // This person's active layer is said to the room while they may edit the photo in focus.
  const activeLayer = canEdit && session ? session.active : null;
  const { publish, on } = presence;
  useEffect(() => {
    publish(activeLayer ? focusId : null, activeLayer);
  }, [publish, focusId, activeLayer]);
  const others = useCallback(
    (layerId: string) => (focusId ? on(focusId, layerId) : []),
    [on, focusId],
  );

  const photo: PhotoEditorView = useMemo(
    () => ({
      photos,
      hasPhotoPage,
      tabId,
      focusId,
      session,
      version,
      canEdit,
      canInspect,
      ctx,
      overlay,
      history,
      depth,
      stepHistory,
      press: setPressed,
      textEdit,
      endTextEdit,
      scope,
      store,
      // Refusals and failures: shown even with notifications off.
      toast: (m: string) => toast.warning(m),
      writePhoto,
      ...(editAsPhoto ? { editAsPhoto } : {}),
      ...(addSizes ? { addSizes } : {}),
      photoRoom,
      ...(exportAllSizes ? { exportAllSizes } : {}),
      ...(rasterizeElement ? { rasterizeElement } : {}),
      runtime: rt,
      others,
      fitPhoto,
      actualPixels,
    }),
    [
      photos,
      hasPhotoPage,
      tabId,
      focusId,
      session,
      version,
      canEdit,
      canInspect,
      ctx,
      overlay,
      history,
      depth,
      stepHistory,
      textEdit,
      endTextEdit,
      scope,
      store,
      toast,
      writePhoto,
      editAsPhoto,
      addSizes,
      photoRoom,
      exportAllSizes,
      rasterizeElement,
      rt,
      others,
      fitPhoto,
      actualPixels,
    ],
  );

  const view = useMemo(
    () => (pagesModeView ? { ...pagesModeView, photo } : pagesModeView),
    [pagesModeView, photo],
  );
  return { view, photo };
}
