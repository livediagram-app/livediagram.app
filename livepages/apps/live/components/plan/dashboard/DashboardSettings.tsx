'use client';

// A Dashboard's settings (docs/specs/026-plan/plan-tabs.md "Dashboard Settings"): a cog in a card at the page's top
// right, level with the menu box, as a board's or a Sheet's cog sits in its header; an Editor's alone. Its sections:
// Dashboard Setup (its name, Add Row, Clear Dashboard), Background (plain or tinted, as two swatches) and Layouts
// (start over from one, drawn small), built from the same parts as a Sheet's Sheet Settings; each change one undo
// step; starting over and clearing ask first.
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DASHBOARD_PRESETS,
  DASHBOARD_ROWS_MAX,
  addDashboardRow,
  clearDashboard,
  relayoutDashboard,
  setDashboardBackground,
  type DashboardBackground,
  type DashboardLayout,
} from '@livepages/document';
import { TextInput, lucideGlyph } from '@livepages/ui';
import {
  lucideEraser,
  lucideLayoutGrid,
  lucidePanelsTopLeft,
  lucidePaintbrush,
  lucideBetweenHorizontalEnd,
} from '@livepages/icons/lucide';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { BoardSettingsSection } from '@/components/palette/PlanBoardMenuSection';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import type { PlanTabActions } from '@/hooks/plan/usePlanTabActions';
import { track } from '@/lib/telemetry';
import { DashboardLayoutPicture } from '../DashboardLayoutPicture';
import { SettingsActionTile, SettingsBody, SettingsField } from '../settings-panel-parts';
import { planPalette } from '../plan-palette';
import { SettingsCog } from '../SettingsCog';
import { dashboardRowCount, revealNewRow } from './reveal-new-row';
import { useSlotDraft } from './useSlotDraft';
import { useMaximisedPlanId } from '@/hooks/plan/maximised-plan';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import {
  DashboardShowMeButton,
  DashboardTourStage,
  useDashboardTour,
  useDashboardTourOffer,
} from '@/components/tour/DashboardTour';

const SetupGlyph = lucideGlyph(lucideLayoutGrid, 14);
const LookGlyph = lucideGlyph(lucidePaintbrush, 14);
const LayoutGlyph = lucideGlyph(lucidePanelsTopLeft, 14);
const AddRowGlyph = lucideGlyph(lucideBetweenHorizontalEnd, 18);
const ClearGlyph = lucideGlyph(lucideEraser, 18);

const NAME_MAX = 80;
const newId = () => crypto.randomUUID();

type Section = 'setup' | 'look' | 'layout';

// The cog's card, portalled onto the canvas at its top right.
export function DashboardSettings({
  canvas,
  canEdit,
  name,
  layout,
  actions,
  onRename,
}: {
  canvas: HTMLElement;
  // The dashboard is an Editor's to change (share-roles); anyone else gets no cog.
  canEdit: boolean;
  name: string;
  layout: DashboardLayout;
  actions: PlanTabActions;
  onRename?: ((name: string) => void) | undefined;
}) {
  const palette = planPalette(useCanvasSurface(), {});
  // Drawn at the toolbar's UI scale, 12 px from the corner, as the menu box is at the other (ToolbarExplorerButton).
  const scale = useUiScale('toolbar');
  // A board, view or Sheet maximised from a slot covers the page and puts its own cog in this corner: the
  // dashboard's steps aside until it is restored (plan-tabs.md "Dashboard Settings").
  const covered = useMaximisedPlanId() !== null;
  // Show Me: the tour of arranging and filling this dashboard, run on the page (plan-tabs.md "Show Me").
  const { tour, freeze } = useDashboardTour(!canEdit || covered);
  // The Dashboards tour offers itself here, once (plan-tour.md "The Dashboards tour").
  useDashboardTourOffer({
    tour,
    freeze,
    canWork: canEdit && !covered,
    slots: () => slotsNow(layout),
  });
  if (!canEdit || covered) return null;
  return createPortal(
    <div
      data-dashboard-settings
      data-floating-panel=""
      style={
        scale === 1
          ? undefined
          : { ...uiScaleStyle(scale), top: toSurfacePx(12, scale), right: toSurfacePx(12, scale) }
      }
      className={`pointer-events-auto absolute right-3 top-3 z-[var(--z-toolbar)] [&_button]:h-9 [&_button]:w-9 ${TOOLBAR_CARD}`}
    >
      <SettingsCog
        label="Dashboard Settings"
        palette={palette}
        onOpen={() => track('Plan', 'Opened', 'DashboardSettings')}
      >
        {(close) => (
          <DashboardSettingsPanel
            name={name}
            layout={layout}
            actions={actions}
            onRename={onRename}
            onClose={close}
            showMe={
              <DashboardShowMeButton
                tour={tour}
                onStart={() => {
                  freeze(slotsNow(layout));
                  close();
                }}
              />
            }
          />
        )}
      </SettingsCog>
      <DashboardTourStage tour={tour} />
    </div>,
    canvas,
  );
}

function DashboardSettingsPanel({
  name,
  layout,
  actions,
  onRename,
  onClose,
  showMe,
}: {
  name: string;
  layout: DashboardLayout;
  actions: PlanTabActions;
  onRename?: ((name: string) => void) | undefined;
  onClose: () => void;
  // The title row's Show Me, beside Help (docs/specs/007-editor/show-me.md).
  showMe?: ReactNode;
}) {
  const palette = planPalette(useCanvasSurface(), {});
  const [open, setOpen] = useState<Section | null>('setup');
  const section = (id: Section) => ({
    open: open === id,
    onToggle: () => setOpen((s) => (s === id ? null : id)),
  });
  const [confirm, setConfirm] = useState<{
    at: HTMLElement;
    message: string;
    label: string;
    run: () => void;
  } | null>(null);
  const holds = layout.rows.some((r) => r.slots.some((s) => s.content));
  const full = layout.rows.length >= DASHBOARD_ROWS_MAX;
  const startOver = (id: string, at: HTMLElement) => {
    const preset = DASHBOARD_PRESETS.find((p) => p.id === id);
    const run = () => {
      actions.changeDashboard((l) => relayoutDashboard(l, id, newId), 'DashboardSlot', {
        prune: true,
      });
      onClose();
    };
    if (!holds) return run();
    setConfirm({
      at,
      message: `Start over as ${preset?.name ?? 'this layout'}? Current slots are removed.`,
      label: 'Start Over',
      run,
    });
  };
  return (
    <>
      {/* The title row: Show Me, then Help on dashboards. */}
      <div className="flex items-center justify-end gap-0.5 border-b border-slate-100 px-1.5 pb-1 dark:border-slate-800">
        {showMe}
        <HelpArticleLink article="planDashboards" variant="labelled" />
      </div>
      <BoardSettingsSection title="Dashboard Setup" icon={<SetupGlyph />} {...section('setup')}>
        <SettingsBody>
          {onRename ? (
            <SettingsField label="Name">
              <NameField name={name} onRename={onRename} />
            </SettingsField>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <SettingsActionTile
              icon={<AddRowGlyph />}
              label="Add Row"
              disabled={full}
              onClick={() => {
                // The new row lands at the foot: close the cog and scroll it into view once drawn.
                const before = dashboardRowCount();
                actions.changeDashboard((l) => addDashboardRow(l, newId), 'DashboardRow');
                onClose();
                revealNewRow(before);
              }}
            />
            <SettingsActionTile
              icon={<ClearGlyph />}
              label="Clear Dashboard"
              disabled={!holds}
              onClick={(e) =>
                setConfirm({
                  at: e.currentTarget,
                  message: 'Empty every slot on this dashboard? Its rows and their sizes stay.',
                  label: 'Clear',
                  run: () => {
                    actions.changeDashboard(clearDashboard, 'DashboardContent', { prune: true });
                    onClose();
                  },
                })
              }
            />
          </div>
          {full ? (
            <p className="px-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              A dashboard holds {DASHBOARD_ROWS_MAX} rows at most.
            </p>
          ) : null}
        </SettingsBody>
      </BoardSettingsSection>
      <BoardSettingsSection title="Background" icon={<LookGlyph />} {...section('look')}>
        <SettingsBody>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Background">
            {BACKGROUNDS.map((b) => {
              const on = (layout.background ?? 'plain') === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() =>
                    actions.changeDashboard((l) => setDashboardBackground(l, b.id), 'DashboardLook')
                  }
                  className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-1.5 text-left transition ${
                    on
                      ? 'border-brand-400 ring-1 ring-brand-400'
                      : 'border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500/60'
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-12 rounded-lg border border-slate-200 dark:border-slate-700"
                    style={{
                      backgroundColor:
                        b.id === 'tint'
                          ? `color-mix(in srgb, ${palette.focus} 10%, ${palette.surface})`
                          : palette.surface,
                    }}
                  />
                  <span className="px-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                    {b.label}
                  </span>
                  <span className="px-1 pb-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    {b.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </SettingsBody>
      </BoardSettingsSection>
      <BoardSettingsSection title="Layouts" icon={<LayoutGlyph />} {...section('layout')}>
        <SettingsBody>
          <p className="px-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Start over from a layout: its empty slots take the place of these.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DASHBOARD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={(e) => startOver(p.id, e.currentTarget)}
                aria-label={`${p.name}: ${p.line}`}
                className="flex cursor-pointer flex-col gap-1 rounded-xl border border-slate-200 p-1.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
              >
                {/* The layout drawn small, in its own frame, kept short in the popover. */}
                <span className="block [&>span]:!h-16">
                  <DashboardLayoutPicture rows={p.rows} palette={palette} />
                </span>
                <span className="px-1 pb-0.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </SettingsBody>
      </BoardSettingsSection>
      {confirm ? (
        <ConfirmPopover
          anchor={confirm.at}
          message={confirm.message}
          confirmLabel={confirm.label}
          onConfirm={() => {
            confirm.run();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}

const BACKGROUNDS: readonly { id: DashboardBackground; label: string; detail: string }[] = [
  { id: 'plain', label: 'Plain', detail: 'The canvas as it is.' },
  { id: 'tint', label: 'Tinted', detail: 'A soft wash of the theme’s colour.' },
];

// The tab's name, saved (trimmed, up to 80 characters) on Enter or leaving; Escape puts it back. Untouched, it follows
// a rename made elsewhere (a collaborator, the tab bar, an undo), so leaving it never puts the old name back.
function NameField({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useSlotDraft(name);
  const save = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
  };
  return (
    <TextInput
      aria-label="Name"
      value={draft}
      maxLength={NAME_MAX}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') save();
        else if (e.key === 'Escape') setDraft(name);
      }}
      onBlur={save}
    />
  );
}

// What Show Me can point at on this dashboard, as it is now.
function slotsNow(layout: DashboardLayout): { hasEmpty: boolean; hasFilled: boolean } {
  const slots = layout.rows.flatMap((r) => r.slots);
  return { hasEmpty: slots.some((s) => !s.content), hasFilled: slots.some((s) => !!s.content) };
}
