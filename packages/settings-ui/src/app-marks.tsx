'use client';

// The apps a setting applies to, drawn as their logos to the left of its name (liveworkspace/docs/specs/010-site/site.md
// "Settings", "Which apps a setting applies to"). The panel's one set of categories holds every app's settings, so
// each row says whose it is: one app's mark, a small block of two or more (at most two across), and liveworkspace's mark alone
// for a setting every app shares, which reads as "every app" without five logos in a row.
//
// Two contexts: the panel's apps (which apps it lists, their names and logos), given by the view that merges them, and
// a row's own apps and the width of its category's column, given by the pane around each row. A row drawn where
// neither is given (an editor's own Settings, a guest's) draws no marks.
import { createContext, memo, useContext, useMemo, type ReactNode } from 'react';
import { Tooltip } from '@liveworkspace/ui';

export type SettingsAppMark = { id: string; name: string; logo: ReactNode };

export type SettingsAppMarks = {
  // Every app the panel lists, in the order their marks are drawn.
  apps: readonly SettingsAppMark[];
  // liveworkspace's mark, for a setting every one of them shares.
  every: ReactNode;
};

const Marks = createContext<SettingsAppMarks | null>(null);

export function SettingsAppMarksProvider({
  value,
  children,
}: {
  value: SettingsAppMarks | null;
  children: ReactNode;
}) {
  return <Marks.Provider value={value}>{children}</Marks.Provider>;
}

export function useSettingsAppMarks(): SettingsAppMarks | null {
  return useContext(Marks);
}

/** Whether `apps` covers every app the panel lists: drawn as liveworkspace's mark alone. */
export function appliesToEvery(apps: readonly string[], marks: SettingsAppMarks): boolean {
  return marks.apps.length > 0 && marks.apps.every((app) => apps.includes(app.id));
}

/** How many marks a row's cluster draws: one for every app, else one per app the panel lists. */
export function markCount(apps: readonly string[], marks: SettingsAppMarks): number {
  if (appliesToEvery(apps, marks)) return 1;
  let count = 0;
  for (const app of marks.apps) if (apps.includes(app.id)) count++;
  return count;
}

// One mark's size and the gap between two, in px. Never overlapping (four overlapping prisms read as one blur of
// colour), and never more than COLUMNS across: three or four apps wrap into a block (two over one; two by two), every
// row starting at the left, so the column stays two marks wide and the name keeps the room.
const MARK = 14;
const GAP = 2;
const COLUMNS = 2;

/** The column a category's marks take, for the widest cluster in it: every row's name starts at the same place. */
export function marksWidth(slots: number): number {
  const across = Math.min(slots, COLUMNS);
  return across <= 0 ? 0 : across * MARK + (across - 1) * GAP;
}

/** "livediagram", "livediagram and liveplanner", "livediagram, liveplanner and livedesign". */
function listNames(names: readonly string[]): string {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

// The row being drawn: its apps, the column's width, and whether it draws its marks (a nested row under a switch with
// the same apps keeps the column but leaves the marks to its parent).
type RowMarks = { rowKey: string; apps: readonly string[]; width: number; hidden: boolean };

const Row = createContext<RowMarks | null>(null);

export function SettingsRowMarksProvider({
  value,
  children,
}: {
  value: RowMarks | null;
  children: ReactNode;
}) {
  return <Row.Provider value={value}>{children}</Row.Provider>;
}

// Whether a cell drawn for `cellKey` is the row's own: its key, or its key before the panel filed it under a group
// (`livediagram.app:appearance` for an editor's own row that draws its cell with its unfiled spec).
const drawsFor = (rowKey: string, cellKey: string) =>
  rowKey === cellKey || rowKey.endsWith(`:${cellKey}`);

/** The marks for the row drawn by `rowKey`, or null where none are drawn. Keyed, so a row drawing cells of its own
 *  (a list of sign-in methods inside one row) draws the marks once, on its own cell. */
export function useRowAppMarks(rowKey: string): ReactNode {
  const marks = useSettingsAppMarks();
  const row = useContext(Row);
  if (!marks || !row || !drawsFor(row.rowKey, rowKey) || row.width === 0) return null;
  return <AppMarks apps={row.apps} width={row.width} hidden={row.hidden} />;
}

// The gap between the marks and the name, in px (the row's `gap-x-3`).
const NAME_GAP = 12;

/** How far what a row draws under its name (an illustration, a list, a note) is set in, so it lines up with the name
 *  rather than with the marks; 0 where none are drawn. */
export function useRowMarksInset(rowKey: string): number {
  const marks = useSettingsAppMarks();
  const row = useContext(Row);
  if (!marks || !row || !drawsFor(row.rowKey, rowKey) || row.width === 0) return 0;
  return row.width + NAME_GAP;
}

/** A row's cluster: its apps' marks in the panel's order, left-aligned in a column `width` wide, so one mark and the first of
 *  several sit at the same place, named for a screen reader and in a tooltip. Memoised on the row's apps, which keep their identity while
 *  the row does. */
export const AppMarks = memo(function AppMarks({
  apps,
  width,
  hidden = false,
}: {
  apps: readonly string[];
  width: number;
  hidden?: boolean;
}) {
  const marks = useSettingsAppMarks();
  const shown = useMemo(() => {
    if (!marks || hidden) return null;
    if (appliesToEvery(apps, marks)) {
      return { label: 'Every App', logos: [{ id: 'all', logo: marks.every }] };
    }
    const listed = marks.apps.filter((app) => apps.includes(app.id));
    if (listed.length === 0) return null;
    return {
      label: listNames(listed.map((app) => app.name)),
      logos: listed.map(({ id, logo }) => ({ id, logo })),
    };
  }, [marks, apps, hidden]);
  // The column stays when there is nothing to draw, so the row's name lines up with its neighbours'.
  if (!shown) {
    return (
      <span
        aria-hidden
        data-settings-app-marks-spacer=""
        className="block shrink-0"
        style={{ width }}
      />
    );
  }
  return (
    <span
      data-settings-app-marks-column=""
      className="flex shrink-0 justify-start"
      style={{ width }}
    >
      <Tooltip label={shown.label}>
        <span
          role="img"
          aria-label={shown.label}
          data-settings-app-marks={shown.logos.map((l) => l.id).join(' ')}
          // Above a switch row's stretched click target, so the tooltip still answers the pointer.
          className="relative z-[1] flex flex-wrap items-center justify-start"
          style={{ gap: GAP, maxWidth: marksWidth(COLUMNS) }}
        >
          {shown.logos.map(({ id, logo }) => (
            <span
              key={id}
              aria-hidden
              className="inline-flex shrink-0 items-center justify-center [&_svg]:size-full"
              style={{ width: MARK, height: MARK }}
            >
              {logo}
            </span>
          ))}
        </span>
      </Tooltip>
    </span>
  );
});
