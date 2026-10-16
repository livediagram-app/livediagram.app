'use client';

// How a tag looks wherever it shows (docs/specs/013-workspace/tags.md "Where tags show"): a dot of its colour, a chip
// (the dot and its name on a faint wash of the colour, so any colour reads on either appearance), a row's chips with
// +N for the rest, and the panel row's dots.

import type { MouseEvent } from 'react';
import { HoverCard, useAppearance } from '@livediagram/ui';
import type { Tag } from '@livediagram/api-schema';
import { tagColourHex, tagWash } from './tag-colour';

// At most this many chips on a row or card before +N (spec "Where tags show"). Safe range 1 to 3: past that a row's
// name truncates to nothing on a phone.
export const ROW_CHIP_MAX = 2;
// At most this many dots on a narrow panel row.
export const PANEL_DOT_MAX = 3;

export function useTagHex(colour: string): string {
  const { appearance } = useAppearance();
  return tagColourHex(colour, appearance);
}

export function TagDot({ colour, size = 8 }: { colour: string; size?: number }) {
  const hex = useTagHex(colour);
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: hex }}
    />
  );
}

const CHIP =
  'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border font-medium text-slate-700 dark:text-slate-200';
const CHIP_SIZE = {
  sm: 'max-w-[9rem] px-1.5 py-px text-[11px] leading-4',
  md: 'max-w-[16rem] px-2.5 py-0.5 text-[13px] leading-5',
} as const;

/** One tag as a chip; a button when `onOpen` is given (it opens the tag's page, never the row under it). */
export function TagChip({
  tag,
  onOpen,
  size = 'sm',
}: {
  tag: Tag;
  onOpen?: () => void;
  size?: 'sm' | 'md';
}) {
  const hex = useTagHex(tag.colour);
  const body = (
    <>
      <TagDot colour={tag.colour} size={size === 'md' ? 9 : 7} />
      <span className="truncate">{tag.name}</span>
    </>
  );
  const style = tagWash(hex);
  const sizing = CHIP_SIZE[size];
  if (!onOpen) {
    return (
      <span className={`${CHIP} ${sizing}`} style={style}>
        {body}
      </span>
    );
  }
  return (
    <HoverCard title={tag.name} description="Show every document with this tag.">
      <button
        type="button"
        onClick={(e: MouseEvent) => {
          // The row or card is a link to the document; the chip goes to the tag instead.
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }}
        aria-label={`Tag ${tag.name}`}
        className={`${CHIP} ${sizing} cursor-pointer transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:brightness-125`}
        style={style}
      >
        {body}
      </button>
    </HoverCard>
  );
}

/** A document's tags on a row or card: the first ROW_CHIP_MAX as chips, then +N naming the rest on hover. */
export function DocumentTagChips({
  tags,
  onOpenTag,
}: {
  tags: readonly Tag[];
  onOpenTag?: (tagId: string) => void;
}) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, ROW_CHIP_MAX);
  const rest = tags.slice(ROW_CHIP_MAX);
  return (
    <span className="inline-flex min-w-0 shrink items-center gap-1" data-tag-chips="">
      {shown.map((t) => (
        <TagChip key={t.id} tag={t} onOpen={onOpenTag ? () => onOpenTag(t.id) : undefined} />
      ))}
      {rest.length > 0 ? (
        <HoverCard title={`${rest.length} more`} description={rest.map((t) => t.name).join(', ')}>
          <span
            tabIndex={0}
            aria-label={`${rest.length} more tags: ${rest.map((t) => t.name).join(', ')}`}
            className="inline-flex shrink-0 items-center rounded-full border border-slate-200 px-1.5 py-px text-[11px] font-medium leading-4 text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            +{rest.length}
          </span>
        </HoverCard>
      ) : null}
    </span>
  );
}

/** A narrow panel row's tags: up to PANEL_DOT_MAX dots, named together on hover. Not buttons. */
export function DocumentTagDots({ tags }: { tags: readonly Tag[] }) {
  if (tags.length === 0) return null;
  const names = tags.map((t) => t.name).join(', ');
  return (
    <HoverCard title={tags.length === 1 ? 'Tag' : 'Tags'} description={names}>
      <span
        className="inline-flex shrink-0 items-center gap-0.5"
        role="img"
        aria-label={`Tags: ${names}`}
      >
        {tags.slice(0, PANEL_DOT_MAX).map((t) => (
          <TagDot key={t.id} colour={t.colour} size={7} />
        ))}
      </span>
    </HoverCard>
  );
}
