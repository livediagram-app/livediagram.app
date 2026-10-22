'use client';

// A Utility's style in its slot (docs/specs/026-plan/plan-tabs.md "Card style"): the stored style, the look it draws
// against the tab's theme, and the changes the Slot Settings cog's Style row makes. A hover previews (the card shows the look,
// nothing is written) and leaving reverts; a pick is one change, one undo step; a slider drag lands as one step once
// it rests.
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { getResolvedAppearance, subscribeAppearance, type Appearance } from '@livedesign/ui';
import {
  dashboardCardLook,
  isDashboardStyledType,
  setDashboardCardStyle,
  shapeColorPresets,
  type DashboardCardLook,
  type DashboardCardStyle,
  type DashboardContent,
  type ShapeColorPreset,
  type ThemeDefinition,
} from '@livedesign/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { getTheme } from '@/lib/themes';
import { useDashboard } from './dashboard-context';

// A slider at rest this long lands as one step.
const CARD_STYLE_DRAG_SETTLE_MS = 400;

// The Dashboard tab's theme, for the viewer's appearance (the Default scheme has a light and a dark half). Outside
// the editor (a test, a preview) the Default scheme.
export function useCardTheme(): ThemeDefinition {
  const themeId = useContext(EditorContext)?.activeTab?.theme;
  const appearance = useViewerAppearance();
  return useMemo(() => getTheme(themeId, appearance), [themeId, appearance]);
}

// The viewer's appearance, kept as it changes (light on the server).
export function useViewerAppearance(): Appearance {
  return useSyncExternalStore(subscribeAppearance, getResolvedAppearance, () => 'light');
}

// A style with its unset fields gone, or undefined when none are left.
function tidy(style: DashboardCardStyle): DashboardCardStyle | undefined {
  const out = Object.fromEntries(
    Object.entries(style).filter(([, v]) => v !== undefined),
  ) as DashboardCardStyle;
  return Object.keys(out).length > 0 ? out : undefined;
}

export type CardStyle = {
  // The stored style, and the look shown (a preview's while one is up).
  style: DashboardCardStyle | undefined;
  shown: DashboardCardStyle | undefined;
  look: DashboardCardLook;
  theme: ThemeDefinition;
  presets: ShapeColorPreset[];
  // Over the stored style: fields set (undefined clears one).
  change: (patch: DashboardCardStyle) => void;
  preview: (patch: DashboardCardStyle) => void;
  // A slider's value: previewed at once, landing once it rests.
  drag: (patch: DashboardCardStyle) => void;
  // The whole style replaced (undefined: the Dashboard's own look).
  replace: (style: DashboardCardStyle | undefined) => void;
  previewReplace: (style: DashboardCardStyle | undefined) => void;
  endPreview: () => void;
};

export function useCardStyle(slotId: string, content: DashboardContent | undefined): CardStyle {
  const { actions } = useDashboard();
  const style =
    content && isDashboardStyledType(content.type)
      ? (content as { style?: DashboardCardStyle }).style
      : undefined;
  // A hovered look, or null for the Dashboard's own; undefined while nothing is hovered.
  const [preview, setPreview] = useState<DashboardCardStyle | null | undefined>(undefined);
  const shown = preview === undefined ? style : (preview ?? undefined);
  const theme = useCardTheme();
  const look = useMemo(() => dashboardCardLook(shown, theme), [shown, theme]);
  const presets = useMemo(() => shapeColorPresets(theme), [theme]);

  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const write = useCallback(
    (next: DashboardCardStyle | undefined) => {
      if (settle.current) clearTimeout(settle.current);
      settle.current = null;
      setPreview(undefined);
      actions.changeDashboard((l) => setDashboardCardStyle(l, slotId, next), 'DashboardCardStyle');
    },
    [actions, slotId],
  );
  // A drag still settling when the slot goes lands then.
  const pending = useRef<DashboardCardStyle | undefined | null>(null);
  useEffect(
    () => () => {
      if (settle.current && pending.current !== null) {
        clearTimeout(settle.current);
        const next = pending.current;
        actions.changeDashboard(
          (l) => setDashboardCardStyle(l, slotId, next),
          'DashboardCardStyle',
        );
      }
    },
    [actions, slotId],
  );

  const over = (patch: DashboardCardStyle) => tidy({ ...style, ...patch });
  return {
    style,
    shown,
    look,
    theme,
    presets,
    change: (patch) => write(over(patch)),
    preview: (patch) => setPreview(over(patch) ?? null),
    drag: (patch) => {
      const next = tidy({ ...shown, ...patch });
      setPreview(next ?? null);
      pending.current = next;
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        pending.current = null;
        write(next);
      }, CARD_STYLE_DRAG_SETTLE_MS);
    },
    replace: (next) => write(next ? tidy(next) : undefined),
    previewReplace: (next) => setPreview((next && tidy(next)) ?? null),
    endPreview: () => {
      if (!settle.current) setPreview(undefined);
    },
  };
}
