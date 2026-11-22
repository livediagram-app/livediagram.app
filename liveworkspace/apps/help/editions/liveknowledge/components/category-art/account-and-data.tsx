import { DocThumb } from '@liveworkspace/help-site/art/parts';
import { AccountAndDataArt as Scene } from '@liveworkspace/help-site/art/scenes/account-and-data';

// Account and Data: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"), with liveknowledge's
// knowledgebases (pages of writing) and the formats a page exports to (Exporting a Knowledgebase).
export function AccountAndDataArt() {
  return (
    <Scene
      formats={['MD', 'PDF', 'Word', 'JSON']}
      work={
        <>
          <DocThumb x={226} y={28} w={56} h={68} accent="amber" lines />
          <DocThumb x={294} y={28} w={56} h={68} accent="violet" lines />
          <DocThumb x={260} y={58} w={60} h={74} accent="brand" lines />
        </>
      }
    />
  );
}
