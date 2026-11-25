'use client';

// The Tab Style dialog every editor shares (liveworkspace/docs/specs/011-workbench/tab-style.md): the home of Looks
// and Fine-tune rows, and the panels they open, inside the shared modal or the product's own frame. The product's
// profile says what it shows on the surface the editor names. Every control applies live to the active tab through
// its setter, eased (lib/tab-style-ease); there is no Apply or Cancel, and closing just dismisses.

import { useEffect, useRef, useState } from 'react';
import { TabStyleSubViewContext, type TabStyleSubView } from './tab-style-subview';
import { BackBar } from '@liveworkspace/ui';
import { resolveFinish, type Finish } from '@liveworkspace/element-model/finish';
import type { TextSize } from '@liveworkspace/model-core/basics';
import { AnimatedHeightBox } from '../../primitives/AnimatedHeightBox';
import { ApplyToAllTabsRow } from '../ApplyToAllTabsRow';
import { easedStyleChange as eased } from '../../../lib/tab-style-ease';
import type { TabLookSettings } from '../../../lib/tab-looks';
import { FinishPanel } from './FinishPanel';
import { LooksHome, tabStylePanelRows } from './LooksHome';
import { TabStyleModal } from './TabStyleModal';
import { TextPanel } from './TextPanel';
import { tabStyleFontLabel } from './tab-style-fonts';
import {
  TAB_STYLE_HELP,
  TAB_STYLE_TITLE,
  resolveTabStyleSurface,
  shownTabStyleView,
  type TabStyleFrameParts,
  type TabStyleLook,
  type TabStyleProfile,
  type TabStyleSurface,
  type TabStyleView,
} from './tab-style-profile';

/** What the editor hands the dialog: the view to show, the tab's style settings and their setters. */
export type TabStyleDialogProps<Look extends TabStyleLook, Pattern extends string> = {
  tab: TabStyleView;
  onTabChange: (tab: TabStyleView) => void;
  // The kind of tab or page the dialog styles (the spec's "Surfaces"); the profile's base when unset.
  surface?: string;
  backgroundPattern: Pattern;
  backgroundColor: string;
  patternColor: string;
  backgroundOpacity: number;
  backgroundPatternScale: number;
  // An animated pattern's speed, 1 its own pace; unset in an editor with no animated patterns (livehuddle's floors).
  backgroundAnimationSpeed?: number;
  onSetBackgroundPattern: (pattern: Pattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onSetBackgroundPatternScale: (scale: number) => void;
  onSetBackgroundAnimationSpeed?: (speed: number) => void;
  // The tab's theme id, widened to string: a stored id may name no built-in theme.
  themeId: string;
  onSetTheme: (id: string) => void;
  // The tab font, null for the editor default; the size new text takes, undefined for medium.
  font: string | null;
  onSetFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetDefaultTextSize: (size: TextSize) => void;
  // The tab's finish, undefined for Flexible.
  finish: Finish | undefined;
  onSetFinish: (finish: Finish) => void;
  // The tab's own background, unresolved, for the previews' paper.
  canvasBackground?: string;
  // The Canvas row's value, when the product's Canvas panel sets something other than the pattern (new pages'
  // background); the pattern's name when unset.
  canvasSummary?: string;
  // A named look's id, or the Mashup card's random look whole: sets the tab's theme, finish, font and pattern at once.
  onApplyLook: (look: string | Look) => void;
  // Apply to All Tabs, at the foot of the home: offered to an Editor of the whole item only, so undefined otherwise.
  allTabs?: { tabCount: number; applying: boolean; onApply: () => void };
  onClose: () => void;
};

export function TabStyleDialog<Look extends TabStyleLook, Pattern extends string>({
  profile,
  ...props
}: TabStyleDialogProps<Look, Pattern> & { profile: TabStyleProfile<Look, Pattern> }) {
  const { tab: asked, onTabChange, surface: surfaceName, finish, onClose } = props;
  const surface = resolveTabStyleSurface(profile, surfaceName);
  const view = shownTabStyleView(asked, surface.panels);
  // How the next view arrives: the first one only fades (the dialog has its own entrance), then a move into a panel
  // slides forward and a move home slides back.
  const [enter, setEnter] = useState<'fade' | 'forward' | 'back'>('fade');
  // A panel's own level (tab-style-subview.ts): its breadcrumb in place of the panel's.
  const [subView, setSubView] = useState<TabStyleSubView | null>(null);
  // One per opening: the dialog mounts as it opens.
  const [openId] = useState(() => `${Date.now()}-${Math.random()}`);
  // Whether the product's own home is on screen (it shows the shared home where it has nothing, a tab with no
  // pages), so Show Me tours the home that is there.
  const viewBox = useRef<HTMLDivElement>(null);
  const [ownHomeShown, setOwnHomeShown] = useState(false);
  // Read after each screen change (the home's cards mount with it).
  useEffect(() => {
    setOwnHomeShown(!!viewBox.current?.querySelector('[data-tour-id="tab-style-cards"]'));
  }, [view]);
  const go = (next: TabStyleView) => {
    setEnter(next === 'looks' ? 'back' : 'forward');
    setSubView(null);
    onTabChange(next);
  };
  const resolvedFinish = resolveFinish(finish, undefined);
  const title = profile.title ?? TAB_STYLE_TITLE;
  const parts: Omit<TabStyleFrameParts, 'children'> = {
    view,
    // The header names the screen that is up: the dialog on its home, a panel inside it, a panel's level inside that.
    title: subView?.current ?? (view === 'looks' ? title : surface.copy.panelTitles[view]),
    dialogTitle: title,
    subtitle: subView?.line ?? surface.copy.viewLines[view],
    ...(subView
      ? {
          onBack: subView.onBack,
          backLabel: `Back to ${view === 'looks' ? title : surface.copy.panelTitles[view]}`,
        }
      : view !== 'looks'
        ? { onBack: () => go('looks'), backLabel: `Back to ${title}` }
        : {}),
    help:
      (view !== 'looks' ? surface.panelHelp?.[view] : surface.homeHelp) ??
      profile.renderHelp(TAB_STYLE_HELP[view]),
    // Show Me's tour of the home, run on this dialog.
    tourApi: {
      panels: surface.panels,
      ownHome: !!surface.renderHome && ownHomeShown,
      showHome: () => (view === 'looks' ? undefined : go('looks')),
      showFinish: () => (view === 'finish' ? undefined : go('finish')),
      finish: () => resolvedFinish,
      setFinish: eased(props.onSetFinish),
    },
    onClose,
  };
  const children = (
    // data-tab-style-view: which view is up, for a replay to hold one open (livediagram's components/tour/replay-dom.ts).
    <div ref={viewBox} data-tab-style-view={view} className="contents">
      {/* The home and its panels swap through an easing height and a short slide: into a panel from the right, back
          home from the left (AnimatedHeightBox). */}
      {/* The modal's way back is its header's back button (owner, 2026-11-25). A frame of the product's own has no
          such button, so it keeps the breadcrumb: back to the home, the panel named in its chip; inside a panel's
          own level, back to the panel instead. */}
      {view !== 'looks' && profile.frame.kind !== 'modal' ? (
        subView ? (
          <BackBar
            flush
            label={surface.copy.panelTitles[view]}
            current={subView.current}
            onClick={subView.onBack}
          />
        ) : (
          <BackBar
            flush
            label={title}
            current={surface.copy.panelTitles[view]}
            onClick={() => go('looks')}
          />
        )
      ) : null}
      {/* Keyed on the panel alone: a panel's own level is the panel's state, which a remount would drop. */}
      <AnimatedHeightBox viewKey={view} enter={enter}>
        <TabStyleSubViewContext.Provider value={setSubView}>
          <TabStyleViewBody
            {...props}
            profile={profile}
            resolved={surface}
            view={view}
            go={go}
            openId={openId}
          />
        </TabStyleSubViewContext.Provider>
      </AnimatedHeightBox>
    </div>
  );
  return profile.frame.kind === 'modal' ? (
    <TabStyleModal frame={profile.frame} {...parts}>
      {children}
    </TabStyleModal>
  ) : (
    profile.frame.render({ ...parts, children })
  );
}

const noop = () => {};

function TabStyleViewBody<Look extends TabStyleLook, Pattern extends string>({
  profile,
  resolved: surface,
  view,
  go,
  openId,
  ...props
}: TabStyleDialogProps<Look, Pattern> & {
  openId: string;
  profile: TabStyleProfile<Look, Pattern>;
  resolved: TabStyleSurface<Look, Pattern>;
  view: TabStyleView;
  go: (next: TabStyleView) => void;
}) {
  const { themeId, font, finish, canvasBackground, defaultTextSize, backgroundPattern } = props;
  const resolvedFinish = resolveFinish(finish, undefined);
  const hidden = new Set(surface.hiddenControls);
  const preview = {
    finish: resolvedFinish,
    canvasBackground,
    themeId,
    font,
    finishLabel: profile.finishLabels[resolvedFinish],
    fontLabel: tabStyleFontLabel(font),
  };
  if (view === 'looks') {
    // The tab's four look settings: which look (or mashup) it wears.
    const settings: TabLookSettings = {
      theme: themeId,
      finish,
      font: font ?? undefined,
      backgroundPattern,
      backgroundOpacity: props.backgroundOpacity,
    };
    const looksHome = (
      <LooksHome
        profile={profile}
        surface={surface}
        settings={settings}
        // Every pick eases the canvas into its new colours.
        onPickLook={eased(props.onApplyLook)}
        themeId={themeId}
        finish={resolvedFinish}
        font={font}
        defaultTextSize={defaultTextSize}
        pattern={backgroundPattern}
        canvasSummary={props.canvasSummary}
        onOpenPanel={go}
        onOpenLink={(open) => {
          props.onClose();
          open();
        }}
      />
    );
    const rows = tabStylePanelRows({
      profile,
      surface,
      themeId,
      finish: resolvedFinish,
      font,
      defaultTextSize,
      pattern: backgroundPattern,
      canvasSummary: props.canvasSummary,
    });
    return (
      <>
        {surface.renderHome
          ? surface.renderHome({
              rows: surface.panels.map((panel) => ({
                panel,
                label: surface.copy.panelTitles[panel],
                ...rows[panel],
              })),
              onOpenPanel: go,
              extra: surface.renderHomeExtra?.() ?? null,
              fallback: looksHome,
              applyLook: eased(props.onApplyLook),
              openId,
              font,
              finish: resolvedFinish,
              ...(props.allTabs ? { allTabs: props.allTabs } : {}),
            })
          : looksHome}
        {props.allTabs && !surface.renderHome ? (
          <div className="mt-5 empty:hidden">
            <ApplyToAllTabsRow {...props.allTabs} tabLocks={profile.tabLocks} />
          </div>
        ) : null}
      </>
    );
  }
  // A panel the product draws itself.
  const own = surface.renderPanel?.(view);
  if (own !== undefined && own !== null) return own;
  if (view === 'font')
    return (
      <TextPanel
        profile={profile}
        font={font}
        onSetFont={eased(props.onSetFont)}
        defaultTextSize={defaultTextSize}
        onSetDefaultTextSize={eased(props.onSetDefaultTextSize)}
        showSize={!hidden.has('defaultTextSize')}
        renderPreview={(p) => surface.renderPreview('text', { ...preview, ...p })}
      />
    );
  if (view === 'finish')
    return (
      <FinishPanel
        profile={profile}
        finish={finish}
        onSetFinish={eased(props.onSetFinish)}
        renderPreview={(p) => surface.renderPreview('finish', { ...preview, ...p })}
      />
    );
  if (view === 'canvas')
    return surface.renderCanvasPanel({
      backgroundPattern,
      backgroundColor: props.backgroundColor,
      patternColor: props.patternColor,
      backgroundOpacity: props.backgroundOpacity,
      backgroundPatternScale: props.backgroundPatternScale,
      backgroundAnimationSpeed: props.backgroundAnimationSpeed ?? 1,
      onSetBackgroundPattern: eased(props.onSetBackgroundPattern),
      onSetBackgroundColor: props.onSetBackgroundColor,
      onSetPatternColor: props.onSetPatternColor,
      onSetBackgroundOpacity: props.onSetBackgroundOpacity,
      onSetBackgroundPatternScale: props.onSetBackgroundPatternScale,
      onSetBackgroundAnimationSpeed: props.onSetBackgroundAnimationSpeed ?? noop,
      hidden,
    });
  const { ThemeBrowser } = profile;
  return (
    <ThemeBrowser
      themeId={themeId}
      onSelect={eased(props.onSetTheme)}
      onCommit={(id) => {
        props.onSetTheme(id);
        props.onClose();
      }}
      className="mt-4"
    />
  );
}
