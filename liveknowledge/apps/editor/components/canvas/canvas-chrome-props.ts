// The canvas props the chrome reads (docs/specs/007-editor/blueprints/typing.md "Performance and limits"). The
// Canvas hands the chrome these and nothing else, behind a memo boundary, so a canvas prop the chrome never reads (the
// chart palette, the arrow preview) changing on a typing commit never renders it. CanvasChromeProps is typed from this
// list, so the chrome reading a prop that is not here fails the typecheck rather than going stale.

import { useLayoutEffect, useState } from 'react';
import { useStableObject } from '@liveworkspace/workbench/hooks/ui/useStableObject';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { PALETTE_ADD_HANDLER_KEYS } from '@/components/palette/palette-add-handlers';
import type { ArticlesView } from '@/hooks/editor/useArticles';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import type { WritingStore } from '@/hooks/ui/usePageContents';

export const CANVAS_CHROME_PROP_KEYS = [
  ...PALETTE_ADD_HANDLER_KEYS,
  'actionRows',
  'activeTabId',
  'canRedo',
  'canUndo',
  'canvasTool',
  'commentRows',
  'commentsPanelPosition',
  'currentDocumentId',
  'currentShareCode',
  'documentName',
  'elements',
  'explorerHidden',
  'explorerMenuActions',
  'formatSourceId',
  'identityLockedName',
  'layers',
  'mapPosition',
  'onCancelDraw',
  'onCancelIdentity',
  'onConfirmIdentity',
  'onExitFormatTool',
  'onFitToScreen',
  'onMoveCommentsPanel',
  'onMoveMap',
  'onNewDocument',
  'onOpenActionForElement',
  'onOpenCanvasTheme',
  'onOpenCommentsForElement',
  'onRedo',
  'onRenameCurrentDocument',
  'renameCurrentNonce',
  'onResetCommentsPanel',
  'onResetMap',
  'onSetCanvasTool',
  'onToggleActionDone',
  'onToggleZen',
  'onUndo',
  'pagesMode',
  'pendingDraw',
  'readOnly',
  'selfParticipant',
  'settings',
  'setViewportOffset',
  'setViewportZoom',
  'showIdentityPrompt',
  'snapGuideStore',
  'tabBackgroundColor',
  'tabFinish',
  'tabFont',
  'tabLayers',
  'tabThemeId',
  'takePart',
  'userPreferences',
  'welcomeOpen',
  'workbenchBack',
  'zenMode',
] as const satisfies readonly (keyof CanvasProps)[];

export type CanvasChromeOwnProps = Pick<CanvasProps, (typeof CANVAS_CHROME_PROP_KEYS)[number]>;

/** Just the chrome's props out of the Canvas's. */
export function pickCanvasChromeProps(props: CanvasProps): CanvasChromeOwnProps {
  const out: Partial<Record<keyof CanvasChromeOwnProps, unknown>> = {};
  for (const key of CANVAS_CHROME_PROP_KEYS) out[key] = props[key];
  return out as CanvasChromeOwnProps;
}

const NONE = {};

/** The pages' view as the chrome sees it: without the writing (Contents reads that from `useWritingStore`), its
 *  actions as stable forwarders, and its identity changing only when a page, the stage or the arrangement does. The
 *  editor rebuilds the view on every render, a typing commit among them. */
export function useChromePagesView(
  view: PagesModeView | null | undefined,
): PagesModeView | null | undefined {
  const {
    articles: _writing,
    edit,
    arrangement,
    ...rest
  } = view ?? (NONE as Partial<PagesModeView>);
  const stableEdit = useStableObject(edit ?? NONE);
  const stableArrangement = useStableObject(arrangement ?? NONE);
  const stable = useStableObject({
    ...rest,
    ...(edit ? { edit: stableEdit } : {}),
    ...(arrangement ? { arrangement: stableArrangement } : {}),
  }) as PagesModeView;
  return view ? stable : view;
}

/** The writing as a store, given each render's after it commits, so a typing commit renders what reads it (Contents)
 *  and not the chrome between. */
export function useWritingStore(articles: ArticlesView | null | undefined): WritingStore {
  const [store] = useState(() => createStateStore(articles));
  useLayoutEffect(() => store.set(articles));
  return store;
}

/** Everything the Canvas hands the chrome: its own props, the pages' view without the writing, and the writing's
 *  store. Behind the chrome's memo boundary, a typing commit changes none of it. */
export function useCanvasChromeProps(
  props: CanvasProps,
): CanvasChromeOwnProps & { writing: WritingStore } {
  const pagesMode = useChromePagesView(props.pagesMode);
  const writing = useWritingStore(props.pagesMode?.articles);
  return { ...pickCanvasChromeProps(props), pagesMode, writing };
}
