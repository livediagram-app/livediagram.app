'use client';

// The Flows dialog's node strip (docs/specs/009-elements/sankey.md "The Flows dialog"): every node as a
// chip in its colour. Click one to rename it everywhere at once: every flow from or to it, and its colour,
// in one step. Renaming onto a name already in the diagram merges the two nodes, which is what typing an
// existing name means.

import { useState } from 'react';
import {
  sankeyGraph,
  SANKEY_NAME_MAX,
  type ChartPaletteId,
  type SankeyFlow,
  type SankeyNodeStyle,
} from '@livedocuments/document';
import { flowNodeColors } from '@/lib/sankey-flow-levels';

export function SankeyNodeStrip({
  flows,
  nodes,
  palette,
  chartPalette,
  onRename,
}: {
  flows: readonly SankeyFlow[];
  nodes: readonly SankeyNodeStyle[] | undefined;
  palette?: readonly string[];
  chartPalette?: ChartPaletteId;
  onRename: (from: string, to: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const graph = sankeyGraph(flows);
  if (graph.nodes.length === 0) return null;
  const colors = flowNodeColors(graph, nodes, palette, chartPalette);
  const finish = (save: boolean) => {
    if (save && editing && draft.trim() && draft.trim() !== editing) onRename(editing, draft);
    setEditing(null);
  };
  return (
    <div className="mb-3" data-tour-id="sankey-nodes">
      <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        Nodes <span className="font-normal">· click one to rename it everywhere</span>
      </p>
      <ul className="flex flex-wrap gap-1" aria-label="Nodes">
        {graph.nodes.map((n) => {
          const color = colors.get(n.name);
          return (
            <li key={n.name}>
              {editing === n.name ? (
                <input
                  autoFocus
                  className="h-7 w-36 rounded-full border border-brand-400 bg-white px-2.5 text-xs text-slate-800 outline-none ring-2 ring-brand-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-500/30"
                  value={draft}
                  maxLength={SANKEY_NAME_MAX}
                  aria-label={`Rename ${n.name}`}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => finish(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      finish(true);
                    } else if (e.key === 'Escape') {
                      // Cancel the rename, not the dialog.
                      e.preventDefault();
                      e.stopPropagation();
                      finish(false);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(n.name);
                    setEditing(n.name);
                  }}
                  aria-label={`Rename ${n.name}`}
                  className="inline-flex h-7 max-w-[12rem] cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-xs text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-optical-line truncate">{n.name}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
