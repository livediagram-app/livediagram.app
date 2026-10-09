'use client';

// A Sheet that cannot show its grid yet or at all (blueprint sheet-element.md "Presentation and UX"): the frame and
// the title, then while it loads the site's loader in a Sheet's form (SheetBuildAnimation: a table filling in, with
// the opening screen's title and sweep); else skeleton grid lines and a quiet line: Couldn't load this sheet (Try
// Again), or This sheet is no longer in this document (Remove, for an editor).
import { COLUMN_WIDTH_NEW, ROW_HEIGHT_NEW } from '@livediagram/sheets';
import { LoadingSweep, SheetBuildAnimation } from '@livediagram/ui';
import { ScaleCapped } from '@/components/canvas/ScaleCapped';
import type { PlanPalette } from '@/components/plan/plan-palette';

export function SheetFace({
  palette,
  title,
  message,
  action,
  loading = false,
}: {
  palette: PlanPalette;
  title: string;
  message: string;
  loading?: boolean;
  action?: { label: string; run: () => void };
}) {
  const lines = `repeating-linear-gradient(to right, ${palette.cardBorder} 0 1px, transparent 1px ${COLUMN_WIDTH_NEW}px), repeating-linear-gradient(to bottom, ${palette.cardBorder} 0 1px, transparent 1px ${ROW_HEIGHT_NEW}px)`;
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border"
      style={{ backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }}
    >
      <div
        className="flex h-10 shrink-0 items-center border-b px-3 text-[14px] font-semibold"
        style={{ borderColor: palette.cardBorder }}
      >
        {title}
      </div>
      {loading ? (
        <div role="status" aria-live="polite" className="flex min-h-0 flex-1 overflow-hidden">
          {/* As the setup cards: shrinks with the Sheet, but stops growing when zoomed in (ScaleCapped). */}
          <ScaleCapped className="flex w-full flex-col items-center justify-center gap-3 px-6">
            <SheetBuildAnimation className="max-w-[240px]" />
            <span className="text-[13px] font-semibold" style={{ color: palette.text }}>
              {message}
            </span>
            <LoadingSweep className="w-28" />
          </ScaleCapped>
        </div>
      ) : (
        <div
          className="relative flex-1"
          style={{ backgroundImage: lines, backgroundPosition: '46px 22px' }}
        >
          {message ? (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px]"
              style={{ color: palette.muted }}
            >
              <span>{message}</span>
              {action ? (
                <button
                  type="button"
                  className="cursor-pointer rounded-md border px-2.5 py-1 text-[12px]"
                  style={{
                    borderColor: palette.border,
                    color: palette.text,
                    backgroundColor: palette.surface,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={action.run}
                >
                  {action.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
