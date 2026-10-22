// Small builders for lint fixtures: boxes and text on a tab, and a quiet lint.

import type { LintCode, LintReport } from '@livedesign/api-schema';
import type { Element, Tab } from '@livedesign/document';
import type { LintLogger } from '../log';
import { lintTab } from '../lint';

export const box = (
  id: string,
  x: number,
  y: number,
  extra: Record<string, unknown> = {},
): Element => ({
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
});

export const text = (
  id: string,
  x: number,
  y: number,
  label: string,
  extra: Record<string, unknown> = {},
): Element => ({ id, type: 'text', x, y, width: 200, height: 40, label, ...extra });

export const tabOf = (...elements: Element[]): Pick<Tab, 'elements' | 'layers'> => ({
  elements,
});

export const quiet = () => {};

export const lint = (
  tab: Pick<Tab, 'elements' | 'layers'>,
  options: { log?: LintLogger } = {},
): LintReport => lintTab(tab, { log: quiet, ...options });

// The findings of one code.
export const of = (report: LintReport, code: LintCode) =>
  report.findings.filter((f) => f.code === code);
