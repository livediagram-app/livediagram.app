import { DocThumb } from '@liveworkspace/help-site/art/parts';
import { AccountAndDataArt as Scene } from '@liveworkspace/help-site/art/scenes/account-and-data';
import { MiniSlide } from './page-parts';

// Account and Data: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with livedocuments's
// documents (an article, a deck and a report) and its export formats (Exporting Documents).
export function AccountAndDataArt() {
  return (
    <Scene
      formats={['PDF', 'PNG', 'SVG', 'JSON']}
      documents={
        <>
          <DocThumb x={226} y={28} w={56} h={68} accent="amber" lines />
          <DocThumb
            x={294}
            y={28}
            w={56}
            h={68}
            accent="violet"
            body={(b) => <MiniSlide {...b} />}
          />
          <DocThumb x={260} y={58} w={60} h={74} accent="brand" lines />
        </>
      }
    />
  );
}
