// The Plan board's colours on each canvas surface (docs/specs/025-plan/blueprints/plan-board.md
// "Presentation and UX"), the same values the SVG export draws (svg-render-plan.ts), so a board looks
// the same on the canvas and in its picture. Text reaches 4.5:1 on its surface in both.
import type { CanvasSurface } from '@livediagram/document';

export type PlanPalette = {
  surface: string;
  border: string;
  column: string;
  card: string;
  cardBorder: string;
  text: string;
  muted: string;
  warning: string;
  warningBg: string;
  focus: string;
};

export function planPalette(surface: CanvasSurface): PlanPalette {
  return surface === 'dark'
    ? {
        surface: '#111827',
        border: '#334155',
        column: '#1e293b',
        card: '#0f172a',
        cardBorder: '#334155',
        text: '#e2e8f0',
        muted: '#94a3b8',
        warning: '#fbbf24',
        warningBg: 'rgba(251, 191, 36, 0.14)',
        focus: '#60a5fa',
      }
    : {
        surface: '#f8fafc',
        border: '#e2e8f0',
        column: '#f1f5f9',
        card: '#ffffff',
        cardBorder: '#e2e8f0',
        text: '#0f172a',
        muted: '#64748b',
        warning: '#b45309',
        warningBg: 'rgba(180, 83, 9, 0.1)',
        focus: '#2563eb',
      };
}

export const PRIORITY_COLOURS = {
  urgent: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#64748b',
} as const;

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
