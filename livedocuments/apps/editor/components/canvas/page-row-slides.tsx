// A page's place in the slide deck, as its Contents ⋯ menu offers it (docs/specs/007-editor/pages-mode.md
// "Contents", "A page's place in the deck lives in Contents"): Present From Here while its slide is shown, then
// Hide in Slides or Show in Slides on any page the deck has a slide of; Add to Slides on any page it has none of.
import type { PageRowAction } from '@liveworkspace/workbench/components/canvas/PageRowMenu';
import { lucideEye, lucideEyeOff, lucidePlay } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import type { PageDeckControls } from '@/hooks/editor/usePagesMode';
import type { ContentsRow } from '@/lib/page-contents';

const PresentIcon = lucideGlyph(lucidePlay, 13);
const EyeIcon = lucideGlyph(lucideEye, 13);
const EyeOffIcon = lucideGlyph(lucideEyeOff, 13);

export function pageRowSlides(
  row: ContentsRow,
  deck: PageDeckControls | undefined,
): PageRowAction[] {
  if (!deck) return [];
  const slide = deck.slideOf(row.id);
  if (!slide) {
    return [
      {
        key: 'add-to-slides',
        label: 'Add to Slides',
        icon: <SlideDeckIcon />,
        run: () => deck.add(row.id),
      },
    ];
  }
  const toggle = () => deck.toggleHidden(slide.id);
  return [
    ...(slide.hidden
      ? []
      : [
          {
            key: 'present-from-here',
            label: 'Present From Here',
            icon: <PresentIcon />,
            run: () => deck.present(slide.id),
          },
        ]),
    slide.hidden
      ? { key: 'show-in-slides', label: 'Show in Slides', icon: <EyeIcon />, run: toggle }
      : { key: 'hide-in-slides', label: 'Hide in Slides', icon: <EyeOffIcon />, run: toggle },
  ];
}
