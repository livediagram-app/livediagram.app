'use client';

// Overview Style (docs/specs/026-plan/plan-overview.md "Style"): the very panel a tab's Style opens, named for the
// Overview and without Finish, its picks running the same tab transforms on the Overview's look (useOverviewEdits).
import dynamic from 'next/dynamic';
import type { OverviewStyle } from '@liveplanner/api-schema';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR, type Tab } from '@liveplanner/project';
import type { CanvasThemeTab } from '@/components/dialogs/CanvasThemeDialog';
import { tabLookById, withLookApplied, type TabLook } from '@/lib/tab-looks';
import { withThemeApplied } from '@/lib/tab-theme-apply';
import { withTabFont, withTabPattern, withTabTextSize } from '@/lib/tab-style-transforms';

const CanvasThemeDialog = dynamic(
  () => import('@/components/dialogs/CanvasThemeDialog').then((m) => m.CanvasThemeDialog),
  { ssr: false },
);

const set =
  <K extends keyof Tab>(key: K) =>
  (value: Tab[K]) =>
  (t: Tab): Tab => ({ ...t, [key]: value });

export function OverviewStyleDialog({
  look,
  tab,
  onTabChange,
  onChange,
  onClose,
}: {
  look: OverviewStyle;
  tab: CanvasThemeTab;
  onTabChange: (tab: CanvasThemeTab) => void;
  onChange: (change: (tab: Tab) => Tab) => void;
  onClose: () => void;
}) {
  const applyLook = (lookOrId: string | TabLook) => {
    const picked = typeof lookOrId === 'string' ? tabLookById(lookOrId) : lookOrId;
    if (picked) onChange((t) => withLookApplied(t, picked));
  };
  return (
    <CanvasThemeDialog
      heading="Overview Style"
      noFinish
      // The Overview has no Finish panel to open.
      tab={tab === 'finish' ? 'looks' : tab}
      onTabChange={onTabChange}
      backgroundPattern={look.backgroundPattern ?? 'grid'}
      backgroundColor={look.backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
      patternColor={look.patternColor ?? DEFAULT_PATTERN_COLOR}
      backgroundOpacity={look.backgroundOpacity ?? 1}
      backgroundPatternScale={look.backgroundPatternScale ?? 1}
      backgroundAnimationSpeed={look.backgroundAnimationSpeed ?? 1}
      onSetBackgroundPattern={(p) => onChange((t) => withTabPattern(t, p))}
      onSetBackgroundColor={(c) => onChange(set('backgroundColor')(c))}
      onSetPatternColor={(c) => onChange(set('patternColor')(c))}
      onSetBackgroundOpacity={(o) => onChange(set('backgroundOpacity')(o))}
      onSetBackgroundPatternScale={(s) => onChange(set('backgroundPatternScale')(s))}
      onSetBackgroundAnimationSpeed={(s) => onChange(set('backgroundAnimationSpeed')(s))}
      themeId={look.theme ?? 'brand'}
      onSetTheme={(id) => onChange((t) => withThemeApplied(t, id))}
      font={look.font ?? null}
      onSetFont={(f) => onChange((t) => withTabFont(t, f))}
      defaultTextSize={look.defaultTextSize}
      onSetDefaultTextSize={(s) => onChange((t) => withTabTextSize(t, s))}
      finish={undefined}
      onSetFinish={() => {}}
      {...(look.backgroundColor ? { canvasBackground: look.backgroundColor } : {})}
      onApplyLook={applyLook}
      onClose={onClose}
    />
  );
}
