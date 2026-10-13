// What a Dashboard card reads as, in words (docs/specs/026-plan/plan-tabs.md "Cards"): shared by the live cards in the
// editor and their still pictures in an image export. Pure.
import type { DashboardLink, SheetMetricKind } from '@livediagram/document';

// What a Key Date's count reads, and whether it has passed.
export function keyDateCount(days: number): { figure: string; unit: string; past: boolean } {
  if (days === 0) return { figure: 'Today', unit: '', past: false };
  if (days === 1) return { figure: 'Tomorrow', unit: '', past: false };
  if (days === -1) return { figure: 'Yesterday', unit: '', past: true };
  if (days > 0) return { figure: String(days), unit: 'days to go', past: false };
  return { figure: String(-days), unit: 'days ago', past: true };
}

// The label a link shows: its own, else its site's host (an email's address), else the tab's name.
export function linkLabelOf(
  link: DashboardLink,
  tabName: (id: string) => string | undefined,
): string {
  if (link.label) return link.label;
  if (link.tabId) return tabName(link.tabId) ?? 'Tab';
  if (link.url?.startsWith('mailto:')) return link.url.slice(7) || link.url;
  try {
    return new URL(link.url!).host || link.url!;
  } catch {
    return link.url!;
  }
}

// Each figure from a Sheet's name.
export const SHEET_METRIC_NAMES: Record<SheetMetricKind, string> = {
  figure: 'Sheet Figure',
  summary: 'Column Summary',
  trend: 'Trend',
};

// What a figure from a Sheet shows (docs/specs/026-plan/plan-tabs.md "Figures from a Sheet"): its name, its figure as
// the sheet formats it, the line under it, and its bar, change or sparkline.
export type SheetMetricShown = {
  label: string;
  hero: string;
  line: string;
  // A bar toward a target: its share (0 to 1, capped), and whether it is met.
  progress?: { share: number; met: boolean; of: string };
  // A trend's move.
  change?: { text: string; dir: 'up' | 'down' | 'flat' };
  spark?: number[];
};
