'use client';

// An Arcade Machine's section in the Editor's element menu (docs/specs/009-elements/social-pieces.md "High Scores",
// "Clearing"): how many scores its table holds, and Clear High Scores, asked first. Only an Editor's menu renders it
// (the host passes `onClear` only at `can.level === 'edit'`); a Participant's and a Viewer's menus are their own.

import type { ShapeElement } from '@livehuddle/document';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';

type SectionProps = (id: string) => { open: boolean; onToggle: () => void };

const CLEAR =
  'h-7 w-full cursor-pointer rounded-md bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-rose-50 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 dark:disabled:hover:bg-rose-500/10';

/** "3 Scores on the table", "1 Score on the table", or No Scores Yet. */
export function arcadeCountLine(count: number): string {
  if (count === 0) return 'No Scores Yet';
  return `${count} ${count === 1 ? 'Score' : 'Scores'} on the table`;
}

/** What the confirm asks: "Clear all 3 scores?", or "Clear 1 score?" for one. */
export function arcadeClearQuestion(count: number): string {
  return count === 1 ? 'Clear 1 score?' : `Clear all ${count} scores?`;
}

export function ArcadeMenuSection({
  target,
  sectionProps,
  onClear,
}: {
  target: ShapeElement;
  sectionProps: SectionProps;
  onClear: () => void;
}) {
  const confirm = useConfirm();
  const count = target.arcadeScores?.length ?? 0;
  const clear = async () => {
    const ok = await confirm({
      title: arcadeClearQuestion(count),
      message: "This can't be undone. The table empties for everyone in the Space.",
      confirmLabel: 'Clear High Scores',
    });
    if (ok) onClear();
  };
  return (
    <MenuAccordionSection
      title="Arcade Machine"
      icon={<ToolsMenuGlyph />}
      {...sectionProps('arcade-machine')}
    >
      <div className="flex flex-col gap-1.5 px-3 pb-2 pt-1">
        <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
          {arcadeCountLine(count)}
        </p>
        <button type="button" onClick={() => void clear()} disabled={count === 0} className={CLEAR}>
          Clear High Scores
        </button>
      </div>
    </MenuAccordionSection>
  );
}
