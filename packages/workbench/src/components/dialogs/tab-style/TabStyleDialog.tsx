'use client';

// The Tab Style dialog every editor shares (liveworkspace/docs/specs/011-workbench/tab-style.md): the home of Looks
// and Fine-tune rows, and the panels they open, inside the shared modal or the product's own frame. The product's
// profile says what it shows on the surface the editor names. Every control applies live to the active tab through
// its setter, eased (lib/tab-style-ease); there is no Apply or Cancel, and closing just dismisses.

import { useState } from 'react';
import { BackBar } from '@liveworkspace/ui';
import { resolveFinish, type Finish } from '@liveworkspace/element-model/finish';
import type { TextSize } from '@liveworkspace/model-core/basics';
import { AnimatedHeightBox } from '../../primitives/AnimatedHeightBox';
import { ApplyToAllTabsRow } from '../ApplyToAllTabsRow';
import { easedStyleChange as eased } from '../../../lib/tab-style-ease';
import type { TabLookSettings } from '../../../lib/tab-looks';
import { FinishPanel } from './FinishPanel';
import { LooksHome } from './LooksHome';
import { TabStyleModal } from './TabStyleModal';
import { TextPanel } from './TextPanel';
import { tabStyleFontLabel } from './tab-style-fonts';
import {
  TAB_STYLE_HELP,
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
  backgroundAnimationSpeed: number;
  onSetBackgroundPattern: (pattern: Pattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onSetBackgroundPatternScale: (scale: number) => void;
  onSetBackgroundAnimationSpeed: (speed: number) => void;
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
  const go = (next: TabStyleView) => {
    setEnter(next === 'looks' ? 'back' : 'forward');
    onTabChange(next);
  };
  const resolvedFinish = resolveFinish(finish, undefined);
  const parts: Omit<TabStyleFrameParts, 'children'> = {
    view,
    subtitle: surface.copy.viewLines[view],
    help: profile.renderHelp(TAB_STYLE_HELP[view]),
    // Show Me's tour of the home, run on this dialog.
    tourApi: {
      showHome: () => (view === 'looks' ? undefined : go('looks')),
      showFinish: () => (view === 'finish' ? undefined : go('finish')),
      finish: () => resolvedFinish,
      setFinish: eased(props.onSetFinish),
    },
    onClose,
  };
  const children = (
    // data-tab-style-view: which view is up, for a replay to hold one open (livediagram's components/tour/replay-dom.ts).
    <div data-tab-style-view={view} className="contents">
      {/* The home and its panels swap through an easing height and a short slide: into a panel from the right, back
          home from the left (AnimatedHeightBox). */}
      <AnimatedHeightBox viewKey={view} enter={enter}>
        {/* Inside a panel: the shared breadcrumb back to the home, the panel named in its chip. */}
        {view !== 'looks' ? (
          <BackBar
            label="Tab Style"
            current={surface.copy.panelTitles[view]}
            onClick={() => go('looks')}
          />
        ) : null}
        <TabStyleViewBody {...props} profile={profile} resolved={surface} view={view} go={go} />
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

function TabStyleViewBody<Look extends TabStyleLook, Pattern extends string>({
  profile,
  resolved: surface,
  view,
  go,
  ...props
}: TabStyleDialogProps<Look, Pattern> & {
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
    return (
      <>
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
          onOpenPanel={go}
        />
        {props.allTabs ? (
          <div className="mt-5 empty:hidden">
            <ApplyToAllTabsRow {...props.allTabs} tabLocks={profile.tabLocks} />
          </div>
        ) : null}
      </>
    );
  }
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
      backgroundAnimationSpeed: props.backgroundAnimationSpeed,
      onSetBackgroundPattern: eased(props.onSetBackgroundPattern),
      onSetBackgroundColor: props.onSetBackgroundColor,
      onSetPatternColor: props.onSetPatternColor,
      onSetBackgroundOpacity: props.onSetBackgroundOpacity,
      onSetBackgroundPatternScale: props.onSetBackgroundPatternScale,
      onSetBackgroundAnimationSpeed: props.onSetBackgroundAnimationSpeed,
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
