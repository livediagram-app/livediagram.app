'use client';

// The Inspect panel (docs/specs/007-editor/wireframe-pages.md "The Inspect panel"): the selected wireframe element's
// size, position, spacing, colours, border and type, every value a press to copy, the element as CSS or as values,
// and its picture at 1x, 2x or 3x. A mode panel: open while the Inspect tool is, homed bottom-right. It reads the
// selection and the canvas it sits in; the export and the link come from the editor (InspectSessionContext).

import { useMemo, useState } from 'react';
import {
  inspectCss,
  inspectValues,
  inspectValuesText,
  pageSurface,
  type Element,
  type Finish,
  type LaidOutPage,
} from '@livedesign/design';
import { lucideDownload, lucideLink } from '@liveworkspace/icons/lucide';
import { Button, lucideGlyph, useCopiedFlash } from '@livedesign/ui';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { SegmentedRadio } from '@liveworkspace/workbench/components/primitives/SegmentedRadio';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';
import { useInspectSession } from '@/components/canvas/inspect/InspectSessionContext';
import { useToast } from '@/hooks/ui/useToast';
import { kindLabel } from '@/lib/element-names';
import {
  INSPECT_EXPORT_SCALES,
  type InspectExportFormat,
  type InspectExportScale,
} from '@/lib/inspect-export';
import {
  inspectNeighbourLines,
  inspectSpacingText,
  inspectTarget,
  inspectTargetSpec,
} from '@/lib/inspect-target';
import { track } from '@/lib/telemetry';
import { InspectSpacingBox } from './InspectSpacingBox';
import { InspectValueCell, InspectSection } from './inspect-panel-parts';

const DownloadIcon = lucideGlyph(lucideDownload, 14);
const LinkIcon = lucideGlyph(lucideLink, 14);

const selectionOf = (s: Selection) => ({
  id: s.multiSelectedIds.size > 0 ? null : s.selectedId,
  count: s.multiSelectedIds.size,
});
const sameSelection = (a: { id: string | null; count: number }, b: typeof a) =>
  a.id === b.id && a.count === b.count;

/** The element's name in the panel and its file: its kind, and its words when it has some. */
export function inspectElementName(el: Element): string {
  const kind = kindLabel(el);
  const words = (el as { label?: string }).label?.trim().split('\n')[0];
  return words ? `${kind} · ${words.length > 32 ? `${words.slice(0, 31)}…` : words}` : kind;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function InspectPanel({
  elements,
  pages,
  tabFont,
  tabFinish,
  ...placement
}: {
  elements: readonly Element[];
  pages: readonly LaidOutPage[];
  tabFont?: string;
  tabFinish?: Finish;
} & ModePanelProps) {
  const session = useInspectSession();
  const toast = useToast();
  const sel = useSelectionOf(selectionOf, sameSelection);
  const target = useMemo(() => inspectTarget(sel.id, elements, pages), [sel.id, elements, pages]);
  const spec = useMemo(
    () => (target ? inspectTargetSpec(target, { font: tabFont, finish: tabFinish }) : null),
    [target, tabFont, tabFinish],
  );
  const lines = useMemo(
    () => (target ? inspectNeighbourLines(target, elements, pages) : []),
    [target, elements, pages],
  );
  const values = useMemo(() => (spec ? inspectValues(spec) : []), [spec]);
  const { copied, flash } = useCopiedFlash<string>();
  const [scale, setScale] = useState<InspectExportScale>(2);
  const [busy, setBusy] = useState<InspectExportFormat | null>(null);

  const copy = async (key: string, text: string, type: string) => {
    if (await copyText(text)) {
      flash(key);
      track('UI', 'Copied', type);
    } else {
      toast.error('Couldn’t copy that. Try again.');
    }
  };
  // Every value the panel shows, in its order: the layout, the spacing, then the rest.
  const valuesText = () =>
    [
      inspectValuesText(values.filter((v) => v.group === 'layout')),
      inspectSpacingText(lines),
      inspectValuesText(values.filter((v) => v.group !== 'layout')),
    ]
      .filter(Boolean)
      .join('\n');
  const valueOf = (name: string, group?: string) =>
    values.find((v) => v.name === name && (!group || v.group === group))?.value;

  const exportAs = async (format: InspectExportFormat) => {
    if (!target || !session || busy) return;
    setBusy(format);
    try {
      await session.exportElement({
        el: target.el,
        elementName: inspectElementName(target.el),
        format,
        scale,
        surface: (target.page && pageSurface(target.page)) ?? 'light',
      });
    } catch {
      toast.error('Couldn’t export that element. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ModePanel helpArticle="inspect" title="Inspect" width="w-auto sm:w-72" {...placement}>
      <div className="flex flex-col gap-3 px-3 pb-3" data-inspect-panel="">
        {!spec || !target ? (
          <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            {sel.count > 0
              ? `${sel.count} elements selected. Select one to inspect it.`
              : 'Select an element to see its size, spacing, colours and type.'}
          </p>
        ) : (
          <>
            <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {inspectElementName(target.el)}
            </p>

            <InspectSection title="Layout">
              <div className="grid grid-cols-2 gap-1">
                {values
                  .filter((v) => v.group === 'layout')
                  .map((v) => (
                    <InspectValueCell
                      key={v.name}
                      name={v.name}
                      value={v.value}
                      copied={copied === `layout:${v.name}`}
                      onCopy={() => void copy(`layout:${v.name}`, v.value, 'InspectValue')}
                    />
                  ))}
              </div>
            </InspectSection>

            <InspectSection title="Spacing">
              <InspectSpacingBox
                lines={lines}
                copied={copied}
                onCopy={(side, value) => void copy(`spacing:${side}`, value, 'InspectValue')}
              />
            </InspectSection>

            <InspectSection title="Colours">
              <div className="grid grid-cols-1 gap-1">
                {(['Fill', 'Border'] as const).map((name) => {
                  const value = valueOf(name, 'colours') ?? 'None';
                  return (
                    <InspectValueCell
                      key={name}
                      name={name}
                      value={value}
                      swatch={value === 'None' ? null : value}
                      copied={copied === `colours:${name}`}
                      onCopy={() => void copy(`colours:${name}`, value, 'InspectValue')}
                    />
                  );
                })}
              </div>
            </InspectSection>

            {values.some((v) => v.group === 'border') ? (
              <InspectSection title="Border">
                <div className="grid grid-cols-3 gap-1">
                  {values
                    .filter((v) => v.group === 'border')
                    .map((v) => (
                      <InspectValueCell
                        key={v.name}
                        name={v.name}
                        value={v.value}
                        copied={copied === `border:${v.name}`}
                        onCopy={() => void copy(`border:${v.name}`, v.value, 'InspectValue')}
                      />
                    ))}
                </div>
              </InspectSection>
            ) : null}

            {spec.text ? (
              <InspectSection title="Text">
                <div className="grid grid-cols-2 gap-1">
                  {values
                    .filter((v) => v.group === 'text')
                    .map((v) => (
                      <InspectValueCell
                        key={v.name}
                        name={v.name}
                        value={v.value}
                        swatch={v.name === 'Colour' ? v.value : undefined}
                        wide={v.name === 'Font'}
                        copied={copied === `text:${v.name}`}
                        onCopy={() => void copy(`text:${v.name}`, v.value, 'InspectValue')}
                      />
                    ))}
                </div>
              </InspectSection>
            ) : null}

            <InspectSection title="Code">
              <div className="grid grid-cols-2 gap-1.5">
                <CopyButton
                  label={copied === 'css' ? 'Copied' : 'Copy CSS'}
                  onClick={() => void copy('css', inspectCss(spec), 'InspectCss')}
                />
                <CopyButton
                  label={copied === 'values' ? 'Copied' : 'Copy Values'}
                  onClick={() => void copy('values', valuesText(), 'InspectValues')}
                />
              </div>
            </InspectSection>

            {session ? (
              <InspectSection title="Export">
                <div className="flex flex-col gap-1.5">
                  <SegmentedRadio
                    label="Export scale"
                    options={INSPECT_EXPORT_SCALES.map((s) => ({ id: s, label: `${s}x` }))}
                    value={scale}
                    onChange={setScale}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['png', 'svg'] as const).map((format) => (
                      <Button
                        variant="none"
                        key={format}
                        busy={busy !== null}
                        onClick={() => void exportAs(format)}
                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-brand-200"
                      >
                        <DownloadIcon />
                        {busy === format ? 'Exporting…' : format.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              </InspectSection>
            ) : null}
          </>
        )}
        {session?.copyLink ? (
          <button
            type="button"
            onClick={() => void session.copyLink?.()}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-200 dark:hover:bg-brand-500/15"
          >
            <LinkIcon />
            Copy Inspect Link
          </button>
        ) : null}
      </div>
    </ModePanel>
  );
}

function CopyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-md bg-slate-900 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
    >
      {label}
    </button>
  );
}
