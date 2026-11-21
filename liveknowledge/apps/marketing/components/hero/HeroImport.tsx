import { Tooltip } from '@liveworkspace/ui';
import { featureHref } from '@liveworkspace/marketing-site/lib/feature-anchor';

import { ConfluenceMark, NotionMark } from './BrandMarks';

// The hero's way in for a team with pages elsewhere (docs/specs/019-marketing/marketing-site.md "Hero", "Import"):
// a quiet capsule as tall as the primary button, "Import From" and the two sources' marks, no other words (owner,
// 2026-11-21). Each mark is a link to its own card on the Import page, named by its accessible name and the shared
// Tooltip with the same word. The Tooltip is the hero's one client island; the rest of the hero is static.
const SOURCES = [
  { name: 'Notion', card: 'From Notion', Mark: NotionMark },
  { name: 'Confluence', card: 'From Confluence', Mark: ConfluenceMark },
] as const;

// Each mark is a 44px circle: a whole touch target inside the 48px capsule.
const MARK_LINK =
  'flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-micro hover:bg-(--hero-thumb) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--hero-ring-focus)';

export function HeroImport() {
  return (
    <div
      role="group"
      aria-label="Import From"
      className="inline-flex h-12 items-center justify-center gap-1 rounded-full border border-(--hero-chip-border) bg-(--hero-chip-bg) pr-0.5 pl-5 text-base font-semibold text-(--hero-chip-text)"
    >
      <span aria-hidden className="text-optical-centre mr-1">
        Import From
      </span>
      <SourceMarks />
    </div>
  );
}

/** The two sources' marks, each a link to its card on the Import page. */
function SourceMarks() {
  return SOURCES.map(({ name, card, Mark }) => (
    <Tooltip key={name} label={name}>
      <a href={featureHref('import', card)} aria-label={name} className={MARK_LINK}>
        <Mark />
      </a>
    </Tooltip>
  ));
}
