'use client';

// An item slide, presented (docs/specs/012-collaboration/presentation-mode.md "Item slides"): the item
// full screen as a card, resolved live from the item store, in the tab's own light or dark look. Its type
// and key over its title, a row of facts (status, assignee, priority, due, estimate, labels), then its
// description with its formatting and its checklist. Fields without a value are left out.
import {
  ITEM_TYPES,
  PRIORITY_LABELS,
  isPriority,
  itemAssignee,
  itemLabels,
  itemStatus,
  itemTitle,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@livediagram/items';
import { NoteRichText } from '@/components/notes/NoteRichText';
import { descriptionRuns } from './ItemDescription';
import { PersonDisc } from './PersonDisc';
import { PlanTypeGlyph } from './plan-type-glyph';
import { PRIORITY_COLOURS, accentOn, type PlanPalette } from './plan-palette';

// How much larger than the panel the description reads on a slide.
const DESCRIPTION_ZOOM = 1.55;

function statusLabel(status: string): string {
  const words = status.replace(/[-_]+/g, ' ').trim();
  return words ? `${words[0]!.toUpperCase()}${words.slice(1)}` : status;
}

function dueLabel(due: string): string {
  const d = new Date(`${due}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? due
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function checklistRows(item: Item): { text: string; done: boolean }[] {
  const rows = item.fields['checklist'];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) =>
    r && typeof r === 'object' && !Array.isArray(r) && typeof r['text'] === 'string'
      ? [{ text: r['text'], done: r['done'] === true }]
      : [],
  );
}

export function ItemSlideView({
  item,
  types,
  palette,
}: {
  // Undefined: the item was deleted.
  item: Item | undefined;
  types: readonly ItemTypeDef[];
  palette: PlanPalette;
}) {
  const frame = (children: React.ReactNode) => (
    <div
      data-item-slide
      className="fixed inset-0 z-[55] flex items-center justify-center overflow-y-auto p-6 sm:p-12"
      style={{ backgroundColor: palette.surface, color: palette.text }}
    >
      {children}
    </div>
  );
  if (!item) {
    return frame(
      <p className="text-2xl font-medium" style={{ color: palette.muted }}>
        This card was deleted
      </p>,
    );
  }
  const type = typeIn(types.length ? types : ITEM_TYPES, item.type);
  const accent = accentOn(type.color, palette);
  const status = itemStatus(item);
  const assignee = itemAssignee(item);
  const priority = item.fields['priority'];
  const due = item.fields['due'];
  const estimate = item.fields['estimate'];
  const labels = itemLabels(item);
  const runs = descriptionRuns(item);
  const hasDescription = runs.some((r) => r.text.trim());
  const checklist = checklistRows(item);
  const doneCount = checklist.filter((r) => r.done).length;
  const fact = 'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-lg';
  const factStyle = { borderColor: palette.cardBorder, backgroundColor: palette.column };

  return frame(
    <article
      className="relative w-[min(64rem,100%)] overflow-hidden rounded-3xl border px-8 py-10 shadow-2xl sm:px-14 sm:py-14"
      style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
      aria-label={`${type.label} #${item.key}: ${itemTitle(item)}`}
    >
      <span
        className="absolute inset-y-0 left-0 w-2.5"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="flex items-center gap-3 text-xl font-semibold" style={{ color: accent }}>
        <PlanTypeGlyph glyph={type.glyph} size={26} color={accent} />
        <span>{type.label}</span>
        <span style={{ color: palette.muted }}>#{item.key}</span>
      </div>
      <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
        {itemTitle(item) || 'Untitled'}
      </h1>
      <div className="mt-7 flex flex-wrap gap-3" style={{ color: palette.text }}>
        {status ? (
          <span className={fact} style={factStyle}>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            {statusLabel(status)}
          </span>
        ) : null}
        {assignee ? (
          <span className={fact} style={factStyle}>
            <PersonDisc person={assignee} />
            {assignee.name}
          </span>
        ) : null}
        {isPriority(priority) ? (
          <span className={fact} style={factStyle}>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PRIORITY_COLOURS[priority] }}
              aria-hidden
            />
            {PRIORITY_LABELS[priority]} priority
          </span>
        ) : null}
        {typeof due === 'string' ? (
          <span className={fact} style={factStyle}>
            Due {dueLabel(due)}
          </span>
        ) : null}
        {typeof estimate === 'number' ? (
          <span className={fact} style={factStyle}>
            {estimate} {estimate === 1 ? 'point' : 'points'}
          </span>
        ) : null}
        {labels.map((l) => (
          <span key={l} className={fact} style={{ ...factStyle, color: palette.muted }}>
            {l}
          </span>
        ))}
      </div>
      {hasDescription ? (
        <div className="mt-9 max-w-none" style={{ zoom: DESCRIPTION_ZOOM }}>
          <NoteRichText note={undefined} noteRich={runs} />
        </div>
      ) : null}
      {checklist.length > 0 ? (
        <section className="mt-9">
          <h2 className="mb-3 text-lg font-semibold" style={{ color: palette.muted }}>
            Checklist · {doneCount} of {checklist.length} done
          </h2>
          <ul className="flex flex-col gap-2 text-xl">
            {checklist.map((r, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold"
                  style={{
                    borderColor: r.done ? accent : palette.cardBorder,
                    backgroundColor: r.done ? accent : 'transparent',
                    color: palette.card,
                  }}
                >
                  {r.done ? '✓' : ''}
                </span>
                <span
                  style={{
                    color: r.done ? palette.muted : palette.text,
                    textDecoration: r.done ? 'line-through' : undefined,
                  }}
                >
                  {r.text}
                </span>
                <span className="sr-only">{r.done ? '(done)' : '(to do)'}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>,
  );
}
