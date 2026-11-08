import { lucideGlyph } from '@liveplanner/ui';
import { lucideArrowUpRight } from '@liveworkspace/icons/lucide';

const OutIcon = lucideGlyph(lucideArrowUpRight, 13);

// A hands-on tour's Learn More (docs/specs/026-plan/plan-tour.md "The mission strip"): the track's help article, in a
// new tab, so the tour and the work stay where they are.
export function LearnMore({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-medium text-brand-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300"
    >
      Learn More
      <OutIcon />
    </a>
  );
}
