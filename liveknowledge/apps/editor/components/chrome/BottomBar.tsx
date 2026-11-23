import { useButtonLabelsSetting } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { TAB_BAR_CLASS } from '@liveworkspace/workbench/components/chrome/tab-shape';
import { safeInlinePadding, safeInset } from '@liveknowledge/ui';
import { MenuErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { ChromeControls } from '@/components/chrome/ChromeControls';
import { FooterMore } from '@/components/chrome/FooterMore';
import { KnowledgeViewTabs } from '@/components/chrome/KnowledgeViewTabs';
// Lazy: the canvas menu (and the icon module it drags in) only loads on the first right-click.
const PortalMenu = dynamic(() => import('./TabPortalMenu').then((m) => m.PortalMenu), {
  ssr: false,
});

// Canvas-scoped actions folded into the canvas menu. (Add-element actions and the
// Cleanup category used to live here too but were removed: the palette and quick-connect cover
// adding, and the command palette's Actions keep Auto Layout and Auto-align.)
export type CanvasMenuActions = {
  // Paste straight from the empty-canvas right-click (docs/specs/008-canvas/canvas-and-palette.md); greyed,
  // not hidden, when the buffer is empty.
  onPaste: () => void;
  canPaste: boolean;
};

// Where the canvas right-click menu should open. `openUp` grows it upward from y rather than down from the cursor.
export type CanvasMenuTarget = { x: number; y: number; openUp?: boolean };

// The current page's verbs, as the canvas menu lists them (TabPortalMenu).
export type CanvasPageMenu = {
  canDelete: boolean;
  canClearContent: boolean;
  locked: boolean;
  selfId: string;
  otherDocuments: { id: string; name: string; savedAt?: number }[];
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onImport: () => void;
  onExport: () => void;
  onCopyTo: (targetDocumentId: string) => Promise<void> | void;
  onToggleLock: () => void;
  onDelete: () => void;
};

type BottomBarProps = {
  // Optional callback that pops the user-preferences dialog (docs/specs/007-editor/user-preferences.md). Available in
  // every role: even view-role visitors can adjust their own browser-local preferences.
  onOpenSettings?: () => void;
  // Optional callback that pops the global search panel.
  onOpenSearch?: () => void;
  // Opens Version History (docs/specs/006-document/version-history.md "In the editor"), on a knowledgebase stored on
  // the server.
  onOpenHistory?: (() => void) | undefined;
  // When set, the current page's menu opens at this point as the canvas right-click menu, with the canvas sections
  // (`canvasActions`) folded in. The page owns the open state (shared with element / multi context menus);
  // `onCloseCanvasMenu` dismisses it. Null when no canvas menu is open.
  canvasMenu?: CanvasMenuTarget | null;
  onCloseCanvasMenu?: () => void;
  canvasActions?: CanvasMenuActions;
  // The current page's verbs for that menu; absent for a session that may not change the knowledgebase's pages,
  // which has no canvas menu.
  pageMenu?: CanvasPageMenu | undefined;
  // A workbench frame (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB34): its Open in liveknowledge link
  // at the bar's right end, and no Appearance control (the workbench sets the scheme).
  workbenchLink?: ((labelled: boolean) => ReactNode) | undefined;
  // A phone: the three tabs are the row, and the bar's other items stand behind one More button.
  phone?: boolean;
};

// The editor's bottom bar (docs/specs/030-knowledgebase/page-surface.md "The footer"): the knowledgebase's three
// views as tabs at its left (Pages | Ask | Insights, KnowledgeViewTabs), then Get Started, Tools, Settings, the
// notification list and the appearance at its right. A bar of the editor's column, under everything that scrolls:
// it never floats over the writing. The pages themselves are the page tree, down the editor's left. It also draws
// the canvas right-click menu.
export function BottomBar({
  onOpenSettings,
  onOpenSearch,
  onOpenHistory,
  canvasMenu,
  onCloseCanvasMenu,
  canvasActions,
  pageMenu,
  workbenchLink,
  phone = false,
}: BottomBarProps) {
  // Settings > Appearance > Button Labels: the footer's names beside its icons (a phone never shows them).
  const labelled = useButtonLabelsSetting();
  return (
    <>
      <div
        data-editor-tabbar
        data-region="tabs"
        // Every control belongs to a landmark (axe "region").
        role="region"
        aria-label="Bottom bar"
        // No `data-app-chrome`: the footer and its tabs follow the knowledgebase's theme, as the rest of the chrome
        // does (docs/specs/030-knowledgebase/page-surface.md "The chrome follows the theme").
        // Clear of the home indicator and a landscape notch (lib/safe-area): the 48px row sits
        // above the bottom inset (the height grows by it), its sides past the side insets.
        style={{
          height: `calc(3rem + ${safeInset('bottom')})`,
          paddingBottom: safeInset('bottom'),
          ...safeInlinePadding('0.75rem'),
        }}
        className={`${TAB_BAR_CLASS} phone:gap-1`}
      >
        {/* The three views, standing on the bar's foot as the other editors' tabs do. */}
        <KnowledgeViewTabs />
        <div aria-hidden className="min-w-0 flex-1 phone:hidden" />
        {/* Shared right-hand cluster (Get Started, Tools, Settings, the notification list, the appearance), reused by
            the Explorer's bottom bar (docs/specs/007-editor/editor-app.md). Labelled here on desktop. On a phone the
            list stays in the row and the rest stand behind More. */}
        {phone ? (
          <>
            <ChromeControls parts="bell" />
            <FooterMore>
              <ChromeControls
                parts="rest"
                onOpenSearch={onOpenSearch}
                onOpenHistory={onOpenHistory}
                onOpenSettings={onOpenSettings}
                settingsLabel="Application settings"
                github={false}
                appearance={!workbenchLink}
              />
            </FooterMore>
          </>
        ) : (
          <ChromeControls
            onOpenSearch={onOpenSearch}
            onOpenHistory={onOpenHistory}
            onOpenSettings={onOpenSettings}
            settingsLabel="Application settings"
            settingsDescription="Your editor preferences. They follow your account, not this knowledgebase."
            // Icons only with Button Labels off; each keeps its hover card, titled with its name.
            labelled={labelled}
            github={false}
            appearance={!workbenchLink}
          />
        )}
        {workbenchLink?.(labelled)}
      </div>
      {canvasMenu && pageMenu && onCloseCanvasMenu && canvasActions ? (
        // A fault inside the menu closes the menu, not the editor.
        <MenuErrorBoundary onError={onCloseCanvasMenu}>
          <PortalMenu
            point={canvasMenu}
            onClose={onCloseCanvasMenu}
            canvas={canvasActions}
            {...pageMenu}
          />
        </MenuErrorBoundary>
      ) : null}
    </>
  );
}
