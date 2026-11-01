// A page's place in the slide deck, as its Contents ⋯ menu offers it (docs/specs/007-editor/pages-mode.md
// "Contents", "A page's place in the deck lives in Contents"): Hide in Slides or Show in Slides on any
// page the deck has a slide of, Add to Slides on a slide page it has none of, else nothing.
import type { PageRowAction } from '@liveworkspace/workbench/components/canvas/PageRowMenu';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { EyeIcon, EyeOffIcon } from '@/components/panels/layers-panel-icons';
import type { PageDeckControls } from '@/hooks/editor/usePagesMode';
import type { ContentsRow } from '@/lib/page-contents';

export function pageRowSlides(
  row: ContentsRow,
  deck: PageDeckControls | undefined,
): PageRowAction[] {
  if (!deck) return [];
  const slide = deck.slideOf(row.id);
  if (slide) {
    const toggle = () => deck.toggleHidden(slide.id);
    return [
      slide.hidden
        ? { key: 'show-in-slides', label: 'Show in Slides', icon: <EyeIcon />, run: toggle }
        : { key: 'hide-in-slides', label: 'Hide in Slides', icon: <EyeOffIcon />, run: toggle },
    ];
  }
  if (row.kind !== 'slide') return [];
  return [
    {
      key: 'add-to-slides',
      label: 'Add to Slides',
      icon: <SlideDeckIcon />,
      run: () => deck.add(row.id),
    },
  ];
}
