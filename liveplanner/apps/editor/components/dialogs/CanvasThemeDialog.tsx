'use client';

// The Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md), opened from the paintbrush dock
// button. One modal, four tabs: Theme (the category-browse picker), Canvas
// (pattern + colours + opacity), Font (the tab's default font + the size
// seeded onto new elements, docs/specs/004-interface-design/fonts.md) and Finish (how elements are drawn,
// docs/specs/008-canvas/finish.md). Opens on whichever tab the caller
// picked; the user can switch freely. Every control applies live to the
// active tab via its callback — there's no Apply/Cancel, closing just
// dismisses.
//
// The tabs render shared components (CanvasStyleControls,
// ThemeCategoryBrowser) so they're identical to the palette accordion and the
// New-project picker respectively. Follows the standard modal contract
// (Portal + click-catcher + Escape) through ClusterPanel, shared with a board's Configure.

import { useState } from 'react';
import { resolveFinish, type BackgroundPattern, type Finish } from '@liveplanner/project';
import { BackBar } from '@liveplanner/ui';
import { canvasThemeHeroArt } from '@liveworkspace/ui/dialog-hero-art/canvas-theme';
import { ClusterPanel } from '@/components/canvas/ClusterPanel';
import { CanvasStyleControls } from '@/components/canvas/CanvasStyleControls';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { AnimatedHeightBox } from '@liveworkspace/workbench/components/primitives/AnimatedHeightBox';
import { ThemeBrowser } from '@/components/palette/ThemeBrowser';
import type { TextSize } from '@liveplanner/project';
import { FinishTab } from './FinishTab';
import { TextTab } from './TextTab';
import { easedStyleChange } from '@liveworkspace/workbench/lib/tab-style-ease';
import { LooksHome } from './LooksHome';
import { ApplyToAllTabsRow } from '@liveworkspace/workbench/components/dialogs/ApplyToAllTabsRow';
import { activeLookId, type LookSettings, type TabLook } from '@/lib/tab-looks';

// 'looks' is the home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"); the others are its Fine-tune panels.
export type CanvasThemeTab = 'looks' | 'canvas' | 'theme' | 'font' | 'finish';

// A setter whose change the canvas eases into rather than snaps to, drawn as a transition.
const eased = easedStyleChange;

// The header's line for each view: what the home and each Fine-tune panel set, in a few words.
const VIEW_LINES: Record<CanvasThemeTab, string> = {
  looks: 'Pick a look for the whole tab, then fine-tune any part of it.',
  theme: 'The colours everything on the tab draws in.',
  finish: 'How everything on the tab is drawn.',
  font: 'The tab’s font, and the size new text starts at.',
  canvas: 'The pattern and colours behind everything.',
};

const PANEL_TITLES: Record<Exclude<CanvasThemeTab, 'looks'>, string> = {
  theme: 'Colours',
  finish: 'Finish',
  font: 'Text',
  canvas: 'Canvas',
};

type CanvasThemeDialogProps = {
  tab: CanvasThemeTab;
  onTabChange: (tab: CanvasThemeTab) => void;
  // Canvas style (current values + live setters).
  backgroundPattern: BackgroundPattern;
  backgroundColor: string;
  patternColor: string;
  backgroundOpacity: number;
  backgroundPatternScale: number;
  backgroundAnimationSpeed: number;
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onSetBackgroundPatternScale: (scale: number) => void;
  onSetBackgroundAnimationSpeed: (speed: number) => void;
  // Theme: a built-in theme id.
  themeId: string;
  onSetTheme: (id: string) => void;
  // Font (docs/specs/004-interface-design/fonts.md). `font` null = the editor default; `defaultTextSize`
  // undefined defaults to medium.
  font: string | null;
  onSetFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetDefaultTextSize: (size: TextSize) => void;
  // Finish (docs/specs/008-canvas/finish.md). `finish` undefined is Flexible.
  finish: Finish | undefined;
  onSetFinish: (finish: Finish) => void;
  // The tab's own background, unresolved, for the Finish preview's paper.
  canvasBackground?: string;
  // Looks: set the tab's theme, finish, font and pattern at once (lib/tab-looks.ts).
  // A named look's id, or the Mashup card's random look whole.
  onApplyLook: (look: string | TabLook) => void;
  // Apply to All Tabs, at the foot of the home (docs/specs/011-theme/canvas-and-theme-dialog.md): offered to an Editor
  // of the whole plan only, so undefined for anyone else.
  allTabs?: { tabCount: number; applying: boolean; onApply: () => void };
  onClose: () => void;
};

export function CanvasThemeDialog({
  tab,
  onTabChange,
  backgroundPattern,
  backgroundColor,
  patternColor,
  backgroundOpacity,
  backgroundPatternScale,
  backgroundAnimationSpeed,
  onSetBackgroundPattern,
  onSetBackgroundColor,
  onSetPatternColor,
  onSetBackgroundOpacity,
  onSetBackgroundPatternScale,
  onSetBackgroundAnimationSpeed,
  themeId,
  onSetTheme,
  font,
  onSetFont,
  defaultTextSize,
  onSetDefaultTextSize,
  finish,
  onSetFinish,
  canvasBackground,
  onApplyLook: applyLook,
  allTabs,
  onClose,
}: CanvasThemeDialogProps) {
  // Every pick eases the canvas into its new colours (@liveworkspace/workbench/lib/tab-style-ease.ts).
  const onApplyLook = eased(applyLook);
  // The tab's four look settings: which look (or mashup) it wears.
  const lookSettings: LookSettings = {
    theme: themeId,
    finish,
    font: font ?? undefined,
    backgroundPattern,
    backgroundOpacity,
  };
  // How the next view arrives: the first one only fades (the dialog has its own entrance), then a move into a panel
  // slides forward and a move home slides back.
  const [enter, setEnter] = useState<'fade' | 'forward' | 'back'>('fade');
  const go = (next: CanvasThemeTab) => {
    setEnter(next === 'looks' ? 'back' : 'forward');
    onTabChange(next);
  };
  return (
    // A popover flying out of the paintbrush, a centred dialog without it, a bottom sheet on a phone (ClusterPanel),
    // under the dialog hero header every app's Tab Style wears (liveworkspace/docs/specs/004-index/dialog-hero-header.md):
    // the swatch fan's band, the title and a line for the view that is up, then Help and the close.
    // "Appearance" is the VIEWER's own light / dark chrome (docs/specs/007-editor/editor-app.md), so this dialog,
    // the tab's look shared with everyone, takes the name of the section that opens it.
    <ClusterPanel
      label="Tab style"
      title="Tab Style"
      subtitle={VIEW_LINES[tab]}
      hero={canvasThemeHeroArt}
      anchorSelector='[data-tour-id="canvas-theme"]'
      onClose={onClose}
      headerEnd={
        <HelpArticleLink
          size="md"
          article={
            tab === 'canvas'
              ? 'changingTheBackground'
              : tab === 'font'
                ? 'choosingFonts'
                : tab === 'finish'
                  ? 'choosingAFinish'
                  : 'changingTheme'
          }
        />
      }
    >
      {/* The home and its panels swap through an easing height and a short slide: into a panel from the
                right, back home from the left (AnimatedHeightBox). */}
      <AnimatedHeightBox viewKey={tab} enter={enter}>
        {/* Inside a panel: the shared breadcrumb back to the home, the panel named in its chip, as the
                import / export panels do (docs/specs/011-theme/canvas-and-theme-dialog.md "Fine-tune"). */}
        {tab !== 'looks' ? (
          <BackBar label="Tab Style" current={PANEL_TITLES[tab]} onClick={() => go('looks')} />
        ) : null}
        {tab === 'looks' ? (
          <>
            <LooksHome
              settings={lookSettings}
              activeLook={activeLookId(lookSettings)}
              onPickLook={onApplyLook}
              themeId={themeId}
              finish={resolveFinish(finish, undefined)}
              font={font}
              defaultTextSize={defaultTextSize}
              pattern={backgroundPattern}
              onOpenPanel={go}
            />
            {allTabs ? (
              <div className="mt-5 empty:hidden">
                <ApplyToAllTabsRow {...allTabs} />
              </div>
            ) : null}
          </>
        ) : tab === 'font' ? (
          <TextTab
            font={font}
            onSetFont={eased(onSetFont)}
            defaultTextSize={defaultTextSize}
            onSetDefaultTextSize={eased(onSetDefaultTextSize)}
            finish={resolveFinish(finish, undefined)}
            canvasBackground={canvasBackground}
            themeId={themeId}
          />
        ) : tab === 'finish' ? (
          <FinishTab
            finish={finish}
            onSetFinish={eased(onSetFinish)}
            canvasBackground={canvasBackground}
            themeId={themeId}
            font={font}
          />
        ) : tab === 'canvas' ? (
          <CanvasStyleControls
            backgroundPattern={backgroundPattern}
            backgroundColor={backgroundColor}
            patternColor={patternColor}
            backgroundOpacity={backgroundOpacity}
            backgroundPatternScale={backgroundPatternScale}
            backgroundAnimationSpeed={backgroundAnimationSpeed}
            onSetBackgroundPattern={eased(onSetBackgroundPattern)}
            onSetBackgroundColor={onSetBackgroundColor}
            onSetPatternColor={onSetPatternColor}
            onSetBackgroundOpacity={onSetBackgroundOpacity}
            onSetBackgroundPatternScale={onSetBackgroundPatternScale}
            onSetBackgroundAnimationSpeed={onSetBackgroundAnimationSpeed}
            showAllPatterns
            previewTiles
          />
        ) : (
          <ThemeBrowser
            themeId={themeId}
            onSelect={eased(onSetTheme)}
            onCommit={(id) => {
              onSetTheme(id);
              onClose();
            }}
            className="mt-4"
          />
        )}
      </AnimatedHeightBox>
    </ClusterPanel>
  );
}
