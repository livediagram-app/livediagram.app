import { DocThumb } from '@liveworkspace/help-site/art/parts';
import { AccountAndDataArt as Scene } from '@liveworkspace/help-site/art/scenes/account-and-data';
import { MiniLogo, MiniWireframe } from './design-parts';

// Account and Data: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with livedesign's designs
// (a logo, an app's screens and another logo) and its export formats (Exporting Tabs: PDF, PNG, SVG and JSON).
export function AccountAndDataArt() {
  return (
    <Scene
      formats={['PNG', 'SVG', 'PDF', 'JSON']}
      work={
        <>
          <DocThumb x={226} y={28} w={56} h={68} accent="brand" body={(b) => <MiniLogo {...b} />} />
          <DocThumb
            x={294}
            y={28}
            w={56}
            h={68}
            accent="violet"
            body={(b) => <MiniWireframe {...b} />}
          />
          <DocThumb x={260} y={58} w={60} h={74} accent="brand" body={(b) => <MiniLogo {...b} />} />
        </>
      }
    />
  );
}
