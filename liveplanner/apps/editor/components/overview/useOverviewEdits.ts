'use client';

// The Overview's writes (docs/specs/026-plan/plan-overview.md "Editing in place", "Style"): the plan's name, its
// description and the Overview's style, each shown at once, saved, and one step in the editor's undo timeline (the
// journal card changes share, `pushUndo`), so Undo and Redo step through them in turn with everything else.
import { useEffect, useRef } from 'react';
import type { OverviewStyle } from '@liveplanner/api-schema';
import type { Tab } from '@liveplanner/project';
import { truncateName } from '@liveworkspace/model-core/names';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { ProjectDetails } from '@/app/project/[id]/editor-persistence';
import type { ItemUndoStep } from '@/hooks/plan/item-undo-journal';
import { saveOverviewStyle, saveProjectDescription } from '@/lib/api/project-details';
import { track } from '@/lib/telemetry';
import { OVERVIEW_STYLE_SAVE_MS, withOverviewChange } from './overview-style';

export type OverviewEditsDeps = {
  projectId: string | null;
  ownerId: string;
  shareCode: string | null;
  projectName: string;
  nameProject: (name: string) => void;
  details: ProjectDetails;
  setProjectDetails: (update: (d: ProjectDetails) => ProjectDetails) => void;
  // What the Overview wears now (its own style, else its first tab's): a pick starts from it.
  look: OverviewStyle;
  pushUndo: (step: ItemUndoStep) => void;
  toastError: (message: string) => void;
  // Injected for tests; the api's by default.
  save?: {
    description: typeof saveProjectDescription;
    style: typeof saveOverviewStyle;
  };
};

const sameStyle = (a: OverviewStyle | null, b: OverviewStyle | null) =>
  JSON.stringify(a) === JSON.stringify(b);

export function useOverviewEdits(deps: OverviewEditsDeps) {
  // Undo steps run later, from the dock or the keyboard: they read the editor as it is then.
  const live = useLatest(deps);
  const scope = () => {
    const d = live.current;
    return d.projectId
      ? { ownerId: d.ownerId, projectId: d.projectId, shareCode: d.shareCode }
      : null;
  };
  const saver = () =>
    live.current.save ?? { description: saveProjectDescription, style: saveOverviewStyle };

  // --- Name: saved as the header's rename is; undone by naming it back. ---
  const applyName = (name: string) => live.current.nameProject(name);
  const rename = (next: string) => {
    const name = truncateName(next);
    const before = live.current.projectName.trim();
    if (!name || name === before) return;
    applyName(name);
    track('Project', 'Renamed');
    live.current.pushUndo({ undo: () => applyName(before), redo: () => applyName(name) });
  };

  // --- Description: shown at once, written, put back (to `fallback`) if the write is refused. ---
  const writeDescription = (description: string, fallback: string) => {
    const at = scope();
    if (!at) return;
    const { setProjectDetails } = live.current;
    setProjectDetails((d) => ({ ...d, description }));
    saver()
      .description(at, description)
      .then(
        (stored) => {
          setProjectDetails((d) => ({ ...d, description: stored }));
          track('Project', 'Changed', 'Description');
        },
        () => {
          setProjectDetails((d) => ({ ...d, description: fallback }));
          live.current.toastError('Couldn’t save the description');
        },
      );
  };
  const describe = (next: string) => {
    const description = next.trim();
    const before = live.current.details.description;
    if (description === before || !scope()) return;
    writeDescription(description, before);
    live.current.pushUndo({
      undo: () => writeDescription(before, description),
      redo: () => writeDescription(description, before),
    });
  };

  // --- Style: shown at once; a run of picks (a slider's drag) saves once and is one undo step. ---
  const burst = useRef<{
    before: OverviewStyle | null;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const writeStyle = (style: OverviewStyle | null, fallback: OverviewStyle | null) => {
    const at = scope();
    if (!at) return;
    const { setProjectDetails } = live.current;
    setProjectDetails((d) =>
      sameStyle(d.overviewStyle, style) ? d : { ...d, overviewStyle: style },
    );
    saver()
      .style(at, style)
      .then(
        (stored) => {
          setProjectDetails((d) =>
            sameStyle(d.overviewStyle, stored) ? d : { ...d, overviewStyle: stored },
          );
          track('Project', 'Changed', 'OverviewStyle');
        },
        () => {
          setProjectDetails((d) => ({ ...d, overviewStyle: fallback }));
          live.current.toastError('Couldn’t save the Overview’s style');
        },
      );
  };
  // The run's end: its last style saved, and the whole run one undo step.
  const flush = () => {
    const run = burst.current;
    if (!run) return;
    clearTimeout(run.timer);
    burst.current = null;
    const after = live.current.details.overviewStyle;
    if (sameStyle(after, run.before)) return;
    writeStyle(after, run.before);
    const before = run.before;
    live.current.pushUndo({
      undo: () => writeStyle(before, after),
      redo: () => writeStyle(after, before),
    });
  };
  const restyle = (change: (tab: Tab) => Tab) => {
    if (!scope()) return;
    const d = live.current;
    const next = withOverviewChange(d.look, change);
    if (burst.current) clearTimeout(burst.current.timer);
    const before = burst.current ? burst.current.before : d.details.overviewStyle;
    burst.current = { before, timer: setTimeout(flush, OVERVIEW_STYLE_SAVE_MS) };
    d.setProjectDetails((p) =>
      sameStyle(p.overviewStyle, next) ? p : { ...p, overviewStyle: next },
    );
  };
  // Closing the Overview mid-run still saves it.
  const flushRef = useLatest(flush);
  useEffect(() => () => flushRef.current(), [flushRef]);

  return { rename, describe, restyle };
}
