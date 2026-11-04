'use client';

// Configure (docs/specs/026-plan/plan-board.md "Configure"): a Board tab's board set up from the bottom-right
// cluster, as Tab Style sets its look. Its home suggests presets drawn from the board's own cards (board-presets.ts)
// and lists each part of the set-up as a tile that says how it stands; a tile opens that part's controls (the same
// ones the board's element menu shows) in a popover pointing at it. Create Form sits in the header. Every change applies live and is one undo step.
import { useMemo, useState, type ReactNode } from 'react';
import type { ShapeElement } from '@liveplanner/project';
import {
  boardAddTypes,
  boardSortFieldsOf,
  normaliseBoardSetup,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { Button, ChevronDownIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideClipboardList } from '@liveworkspace/icons/lucide';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { ClusterPanel } from '@/components/canvas/ClusterPanel';
import { usePlan } from '@/components/plan/PlanContext';
import { trackSetup } from '@/components/plan/track-board-setup';
import { usePlanTabKind } from '@/hooks/plan/plan-cover-store';
import {
  PLAN_BOARD_SECTIONS,
  type PlanBoardSectionId,
} from '@/components/palette/PlanBoardMenuSection';
import { boardPresets, type BoardPreset } from './board-presets';
import { PresetArt } from './PresetArt';

const FormIcon = lucideGlyph(lucideClipboardList, 16);

const LANE_NAMES: Record<PlanBoardSetup['swimlaneBy'], string> = {
  none: 'No rows',
  assignee: 'A row per person',
  type: 'A row per card type',
  priority: 'A row per priority',
  status: 'A row per status',
  field: 'A row per field value',
};

// How each part stands now, in a few words, for its tile.
function summary(
  id: PlanBoardSectionId,
  setup: PlanBoardSetup,
  plan: ReturnType<typeof usePlan>,
): string {
  const types = plan?.types ?? [];
  switch (id) {
    case 'columns':
      return `${setup.columns.length} ${setup.columns.length === 1 ? 'column' : 'columns'}`;
    case 'swimlanes':
      return LANE_NAMES[setup.swimlaneBy];
    case 'sort-cards': {
      if (!setup.sortBy?.length) return 'In the order you put them';
      const names = new Map(boardSortFieldsOf(types).map((f) => [f.id, f.label]));
      return setup.sortBy.map((l) => names.get(l.field) ?? 'A field').join(', then ');
    }
    case 'supported-cards': {
      const shown = boardAddTypes(setup, types).length;
      return shown === types.length
        ? `All ${types.length} card ${types.length === 1 ? 'type' : 'types'}`
        : `${shown} of ${types.length} card types`;
    }
    case 'card-layout':
      return setup.cardSize === 'minimal' ? 'Minimal cards' : 'Detailed cards';
  }
}

export function BoardConfigureDialog({
  element,
  onClose,
}: {
  element: ShapeElement;
  onClose: () => void;
}) {
  const plan = usePlan();
  const onBoardTab = usePlanTabKind() === 'board';
  // The part whose popover is open, and the tile it points at.
  const [open, setOpen] = useState<{ id: PlanBoardSectionId; tile: HTMLElement } | null>(null);
  const setup = normaliseBoardSetup(element.planBoard);
  const presets = useMemo(
    () => (setup && plan ? boardPresets(setup, plan.types, plan.items.values()) : []),
    [setup, plan],
  );
  if (!setup || !plan?.canEdit) return null;
  const sections = PLAN_BOARD_SECTIONS.filter((x) => x.shows(setup));
  const section = open ? sections.find((x) => x.id === open.id) : undefined;
  const applyPreset = (p: BoardPreset) => {
    plan.updateBoard(element.id, p.apply(setup));
    trackSetup(`Preset.${p.id}`);
  };
  // New Form (docs/specs/030-forms/forms.md "Starting a form"): a form whose responses come to this board.
  const offersForm =
    !!plan.newFormFor &&
    onBoardTab &&
    !setup.allCards &&
    !setup.archive &&
    setup.columns.length > 0;

  return (
    <ClusterPanel
      label="Configure board"
      title="Configure Board"
      subtitle="Start from a layout that suits your cards, then fine-tune any part of it."
      anchorSelector='[data-tour-id="configure-board"]'
      width="w-[54rem]"
      onClose={onClose}
      headerEnd={
        offersForm ? (
          // A form whose responses come to this board (docs/specs/030-forms/forms.md "Starting a form").
          <Tooltip label="Collect cards for this board from anyone with a link">
            <Button
              variant="secondary"
              size="sm"
              // No room beside the title on a phone (docs/specs/026-plan/plan-board.md "Configure").
              className="mr-1 max-sm:hidden"
              onClick={() => {
                onClose();
                plan.newFormFor?.(element.id);
              }}
            >
              <FormIcon aria-hidden />
              Create Form
            </Button>
          </Tooltip>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        {presets.length ? (
          <HomeGroup title="Suggested for This Board">
            <div className="grid grid-cols-3 gap-2 max-md:grid-cols-2 max-sm:grid-cols-1">
              {presets.map((p) => (
                <PresetCard key={p.id} preset={p} onPick={() => applyPreset(p)} />
              ))}
            </div>
          </HomeGroup>
        ) : null}
        <HomeGroup title="Fine-Tune">
          <div className="grid grid-cols-3 gap-2 max-md:grid-cols-2 max-sm:grid-cols-1">
            {sections.map((x) => {
              const isOpen = open?.id === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={isOpen}
                  // Pressed again, it closes its popover.
                  onClick={(e) => setOpen(isOpen ? null : { id: x.id, tile: e.currentTarget })}
                  className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isOpen
                      ? 'border-brand-400 bg-brand-50/60 dark:border-brand-500/70 dark:bg-brand-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    {x.icon}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
                      {x.title}
                    </span>
                    <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {summary(x.id, setup, plan)}
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={`shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              );
            })}
          </div>
        </HomeGroup>
      </div>
      {open && section ? (
        // The part's own controls, as its element menu flyout holds them, in a popover pointing at its tile.
        <AnchoredPopover
          anchor={open.tile}
          name={section.title}
          // Columns lists each column with its controls, so it takes more room.
          width={open.id === 'columns' ? 380 : 300}
          pointer
          scrim
          onClose={() => setOpen(null)}
        >
          <div className="flex flex-col py-1">
            <section.Body element={element} open onClose={onClose} />
          </div>
        </AnchoredPopover>
      ) : null}
    </ClusterPanel>
  );
}

function HomeGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

// One preset: a small drawing of the layout, its name, what it does and why it suits this board.
function PresetCard({ preset, onPick }: { preset: BoardPreset; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={preset.active}
      onClick={onPick}
      className={`group relative flex cursor-pointer gap-3 rounded-lg border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        preset.active
          ? 'border-brand-400 bg-brand-50/60 dark:border-brand-500/70 dark:bg-brand-500/10'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600 dark:hover:bg-slate-800/80'
      }`}
    >
      <PresetArt
        id={preset.art}
        className={`h-14 w-20 shrink-0 rounded-md transition ${
          preset.active
            ? 'bg-white text-brand-700 dark:bg-slate-900 dark:text-brand-300'
            : 'bg-slate-100 text-slate-400 group-hover:text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:text-slate-300'
        }`}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {preset.title}
        </span>
        <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {preset.detail}
        </span>
        {preset.reason ? (
          <span className="mt-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            {preset.reason}
          </span>
        ) : null}
      </span>
    </button>
  );
}
