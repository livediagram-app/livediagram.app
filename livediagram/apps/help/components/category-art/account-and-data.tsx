import { DocThumb } from '@liveworkspace/help-site/art/parts';
import { AccountAndDataArt as Scene } from '@liveworkspace/help-site/art/scenes/account-and-data';

// Account and Data: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with livediagram's
// documents (two diagrams and a page of notes) and its export formats.
export function AccountAndDataArt() {
  return (
    <Scene
      formats={['PNG', 'SVG', 'PDF', 'JSON']}
      documents={
        <>
          <DocThumb x={226} y={28} w={56} h={68} accent="violet" />
          <DocThumb x={294} y={28} w={56} h={68} lines />
          <DocThumb x={260} y={58} w={60} h={74} accent="brand" />
        </>
      }
    />
  );
}
