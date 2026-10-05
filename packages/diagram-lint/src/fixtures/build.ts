// Small builders for lint fixtures: boxes, frames, lanes and pinned arrows on a tab, and a quiet lint.

import type { LintCode, LintReport } from '@livediagram/api-schema';
import type { Anchor, ArrowElement, Element, Tab } from '@livediagram/document';
import { lintTab, type LintOptions } from '../lint';

export const box = (
  id: string,
  x: number,
  y: number,
  extra: Record<string, unknown> = {},
): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: 120,
    height: 60,
    textSize: 'sm',
    label: id,
    ...extra,
  }) as Element;

export const frame = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  shape = 'frame',
): Element => ({ id, type: 'shape', shape, x, y, width, height, label: id }) as Element;

export const arrow = (
  id: string,
  from: string,
  to: string,
  anchors: [Anchor, Anchor] = ['e', 'w'],
  extra: Record<string, unknown> = {},
): Element =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: anchors[0] },
    to: { kind: 'pinned', elementId: to, anchor: anchors[1] },
    ...extra,
  }) as ArrowElement;

export const tabOf = (...elements: Element[]): Pick<Tab, 'elements' | 'layers' | 'theme'> => ({
  elements,
});

export const quiet = () => {};

export const lint = (
  tab: Pick<Tab, 'elements' | 'layers' | 'theme'>,
  options: LintOptions = {},
): LintReport => lintTab(tab, { log: quiet, ...options });

// The findings of one code.
export const of = (report: LintReport, code: LintCode) =>
  report.findings.filter((f) => f.code === code);
