'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { Tooltip } from '@/components/primitives/Tooltip';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { GearIcon } from '@/components/chrome/tab-bar-icons';
import { ResetPositionGlyph } from '@/components/primitives/ResetPositionGlyph';
import { useClickOutside } from '@/hooks/ui/useClickOutside';
import { useEscape } from '@/hooks/ui/useEscape';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import { track } from '@/lib/telemetry';
import type { UserPreferences } from '@/lib/user-preferences';

// Palette-scoped settings, opened from a sliders icon in the Palette
// header (the only button left there besides minimise). The first step in
// retiring the standalone Settings dialog (spec/20): canvas-behaviour
// preferences live next to the canvas they govern instead of in a
// context-free modal. iOS-style switches, concise labels. It also hosts
// the panel-layout toggle and the reset-position action that used to be
// their own header buttons, so the header stays uncluttered.
//
// The trigger lives inside the MovablePanel header; the popover panel is
// portal-rendered so the panel's `overflow` / stacking context can't clip
// it. Closes on outside click or Escape.

const WIDTH = 240;
const GAP = 8; // space between the trigger and the popover

type PaletteSettingsPopoverProps = {
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
  // Panel-layout toggle (floating panels <-> minimal dock bar), moved here
  // from its own header button. Omitted for roles without the toggle.
  minimalPanels?: boolean;
  onToggleMinimalPanels?: () => void;
  // Snap the Palette back to its default corner. Omitted when there's
  // nothing to reset (the panel hasn't been dragged). Closes the popover
  // after firing — the panel (and this trigger) jump to the corner.
  onResetPosition?: () => void;
  resettable?: boolean;
};

export function PaletteSettingsPopover({
  settings,
  onChange,
  minimalPanels,
  onToggleMinimalPanels,
  onResetPosition,
  resettable,
}: PaletteSettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      if (!t) return;
      // Right-align the popover under the trigger (the Palette hugs the
      // top-right), then clamp so the left edge stays on-screen.
      const left = Math.max(EDGE, Math.min(t.right - WIDTH, window.innerWidth - WIDTH - EDGE));
      setPos({ left, top: t.bottom + GAP });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Close on outside click. The trigger is portal-separated from the
  // panel, so whitelist it: a click on the gear is "inside" (its own
  // onClick toggles closed), not an outside dismissal that would race.
  useClickOutside(panelRef, () => setOpen(false), open, '[data-palette-settings-trigger]');
  useEscape(() => setOpen(false), { enabled: open });

  const autoRebind = settings.autoRebindArrows !== false;
  const alignment = settings.alignmentGuides !== false;
  const quickAddOnHover = settings.quickAddOnHover === true;
  const panelOpacity = settings.panelOpacity ?? 1;

  // Persist the panel-opacity slider on release (not per drag tick):
  // writeUserPreferences fires a D1 PUT on every call, so the live drag
  // feedback is handled by the CSS var inside PanelOpacityRow and only the
  // final value is written here. Telemetry once per adjustment (spec/22).
  const commitOpacity = (next: number) => {
    if (next === panelOpacity) return;
    track('UI', 'Changed', 'PanelOpacity');
    onChange({ ...settings, panelOpacity: next });
  };

  const apply = (patch: Partial<UserPreferences>, telemetry: string) => {
    // Telemetry before persistence so the flip itself reaches the wire
    // even when the new state would suppress later emission (matches the
    // Settings dialog handlers). See spec/22.
    track('UI', 'Toggled', telemetry);
    onChange({ ...settings, ...patch });
  };

  return (
    <>
      <Tooltip title="Palette settings" description="Canvas behaviour for this editor.">
        <button
          ref={triggerRef}
          type="button"
          data-palette-settings-trigger
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setOpen((v) => !v)}
          aria-label="Palette settings"
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`flex h-5 w-5 items-center justify-center rounded transition ${
            open
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
          }`}
        >
          <GearIcon />
        </button>
      </Tooltip>
      {open ? (
        <Portal>
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Palette settings"
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed z-[var(--z-overlay)] flex animate-fade-in flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: WIDTH }}
          >
            <SettingRow
              label="Auto-attach arrows"
              hint="Re-pin arrows to the nearest face as shapes move."
              checked={autoRebind}
              onToggle={() =>
                apply(
                  { autoRebindArrows: !autoRebind },
                  !autoRebind ? 'AutoRebindOn' : 'AutoRebindOff',
                )
              }
              help={
                <HelpArticleLink
                  article="autoAttachArrows"
                  title="Auto-attach arrows"
                  description="How arrows re-pin to shapes as they move."
                />
              }
            />
            <SettingRow
              label="Alignment guides"
              hint="Show snap lines while moving or resizing."
              checked={alignment}
              onToggle={() =>
                apply(
                  { alignmentGuides: !alignment },
                  !alignment ? 'AlignmentGuidesOn' : 'AlignmentGuidesOff',
                )
              }
              help={
                <HelpArticleLink
                  article="alignmentGuides"
                  title="Alignment guides"
                  description="How snap lines help you line elements up."
                />
              }
            />
            <SettingRow
              label="Quick-add on hover"
              hint="Open an element's + menu on hover, not a click."
              checked={quickAddOnHover}
              onToggle={() =>
                apply(
                  { quickAddOnHover: !quickAddOnHover },
                  !quickAddOnHover ? 'QuickAddHoverOn' : 'QuickAddHoverOff',
                )
              }
              help={
                <HelpArticleLink
                  article="quickAddOnHover"
                  title="Quick-add on hover"
                  description="Open the element + menu by hovering instead of clicking."
                />
              }
            />
            {!minimalPanels ? (
              <>
                {/* Separator: set the panel-opacity control apart. */}
                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                <PanelOpacityRow
                  value={panelOpacity}
                  onCommit={commitOpacity}
                  help={
                    <HelpArticleLink
                      article="panelOpacity"
                      title="Panel opacity"
                      description="Make the floating panels translucent so the canvas shows through."
                    />
                  }
                />
              </>
            ) : null}
            {onToggleMinimalPanels ? (
              <>
                {/* Separator: set the minimal-panels toggle apart. */}
                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                <SettingRow
                  label="Minimal panels"
                  hint="Swap floating panels for a compact button bar."
                  checked={!!minimalPanels}
                  // Telemetry + persistence live in the caller's handler.
                  onToggle={onToggleMinimalPanels}
                  help={
                    <HelpArticleLink
                      article="minimalPanels"
                      title="Minimal panels"
                      description="The compact button bar that replaces floating panels."
                    />
                  }
                />
              </>
            ) : null}
            {onResetPosition ? (
              <>
                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                <button
                  type="button"
                  disabled={!resettable}
                  onClick={() => {
                    onResetPosition();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:hover:bg-transparent"
                >
                  <ResetPositionGlyph />
                  <span className="flex flex-col">
                    <span>Reset position</span>
                    <span className="text-[10px] font-normal leading-snug text-slate-400 dark:text-slate-500">
                      {resettable
                        ? 'Snap back to the default corner.'
                        : 'Already at the default corner.'}
                    </span>
                  </span>
                </button>
              </>
            ) : null}
          </div>
        </Portal>
      ) : null}
    </>
  );
}

// The same diagonal "snap-back" glyph the old header reset button used,
// kept consistent now that the action moved into the popover.

function SettingRow({
  label,
  hint,
  checked,
  onToggle,
  help,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onToggle: () => void;
  // Optional help affordance rendered beside (not inside) the row button,
  // so the `?` link isn't nested in the row's interactive element.
  help?: ReactNode;
}) {
  const row = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">{hint}</span>
      </span>
      <ToggleSwitch checked={checked} label={label} presentational />
    </button>
  );
  if (!help) return row;
  return (
    <div className="flex items-center gap-1 pr-1">
      <span className="min-w-0 flex-1">{row}</span>
      {help}
    </div>
  );
}

// Panel-opacity slider row. Holds a local draft so the thumb tracks the
// drag, and sets the --lvd-panel-opacity custom property imperatively on
// each input so the floating panels go translucent live. The persisted
// value (which writes to localStorage + D1) is committed on release via
// onCommit. `value` is the persisted opacity (0..1); the effect re-syncs
// the draft when it changes from elsewhere (e.g. a cross-device sync).
function PanelOpacityRow({
  value,
  onCommit,
  help,
}: {
  value: number;
  onCommit: (next: number) => void;
  help?: ReactNode;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const previewLive = (v: number) => {
    if (typeof document === 'undefined') return;
    if (v >= 1) document.documentElement.style.removeProperty('--lvd-panel-opacity');
    else document.documentElement.style.setProperty('--lvd-panel-opacity', String(v));
  };

  return (
    <div className="flex items-center gap-1 pr-1">
      <div className="min-w-0 flex-1 rounded-md px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Panel opacity
          </span>
          <span className="text-[10px] font-medium text-slate-400 tabular-nums dark:text-slate-500">
            {Math.round(draft * 100)}%
          </span>
        </div>
        <span className="mb-1.5 block text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          See the canvas through floating panels.
        </span>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={draft}
          aria-label="Panel opacity"
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setDraft(v);
            previewLive(v);
          }}
          onPointerUp={() => onCommit(draft)}
          onKeyUp={() => onCommit(draft)}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
        />
      </div>
      {help}
    </div>
  );
}
