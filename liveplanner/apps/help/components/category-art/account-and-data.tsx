import { DocThumb } from '@liveworkspace/help-site/art/parts';
import { AccountAndDataArt as Scene } from '@liveworkspace/help-site/art/scenes/account-and-data';
import { MiniBoard, MiniSheet } from './plan-parts';

// Account and Data: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with liveplanner's plans
// (two boards and a sheet) and the formats a tab exports to (Export Tabs: CSV, PNG, PDF and JSON among them).
export function AccountAndDataArt() {
  return (
    <Scene
      formats={['CSV', 'PNG', 'PDF', 'JSON']}
      documents={
        <>
          <DocThumb
            x={226}
            y={28}
            w={56}
            h={68}
            accent="amber"
            body={(b) => <MiniBoard {...b} header={false} />}
          />
          <DocThumb
            x={294}
            y={28}
            w={56}
            h={68}
            accent="emerald"
            body={(b) => <MiniSheet {...b} />}
          />
          <DocThumb
            x={260}
            y={58}
            w={60}
            h={74}
            accent="brand"
            body={(b) => <MiniBoard {...b} header={false} />}
          />
        </>
      }
    />
  );
}
