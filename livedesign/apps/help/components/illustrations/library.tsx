// The Library illustrations for The Library article (docs/specs/018-help/help-app.md; drawing
// liveworkspace/docs/specs/006-media/libraries.md). Real labels from the shared workbench's SaveToLibraryDialog.tsx
// (Save to Library, Name, Save to, Personal with "Only you", a team's line, Folder (optional), Save) and
// LibraryPaletteTab.tsx (Search the library, a folder heading per scope, the saved tiles).

import {
  Button,
  Dialog,
  Label,
  Scene,
  Shape,
  TextBar,
} from '@liveworkspace/help-site/art/primitives';

function Destination({
  x,
  y,
  title,
  line,
  on,
}: {
  x: number;
  y: number;
  title: string;
  line: string;
  on: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={356}
        height={36}
        rx={8}
        className={on ? 'fill-brand-50 stroke-brand-500' : 'fill-white stroke-slate-200'}
        strokeWidth={on ? 2 : 1.5}
      />
      <rect
        x={x + 8}
        y={y + 7}
        width={22}
        height={22}
        rx={5}
        className={on ? 'fill-brand-100' : 'fill-slate-100'}
      />
      <Label x={x + 40} y={y + 13} size={11} weight={600} tone="strong">
        {title}
      </Label>
      <Label x={x + 40} y={y + 27} size={10} tone="body">
        {line}
      </Label>
    </g>
  );
}

/** The Save to Library dialog: the item's name, Personal or a team, an optional folder, and Save. */
export function SaveToLibraryScene() {
  return (
    <Scene w={420} h={300} bg="plain">
      <Dialog
        x={16}
        y={8}
        w={388}
        h={284}
        title="Save to Library"
        sceneW={420}
        sceneH={300}
        scrim={false}
      >
        <Label x={32} y={60} size={10} weight={600} tone="body">
          Name
        </Label>
        <rect
          x={32}
          y={68}
          width={356}
          height={24}
          rx={6}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={42} y={81} size={11} tone="strong">
          Hero header
        </Label>
        <Label x={32} y={110} size={10} weight={600} tone="body">
          Save to
        </Label>
        <Destination x={32} y={118} title="Personal" line="Only you" on={false} />
        <Destination
          x={32}
          y={160}
          title="Design team"
          line="Everyone in the team can place it. Admins tidy it."
          on
        />
        <Label x={32} y={214} size={10} weight={600} tone="body">
          Folder (optional)
        </Label>
        <rect
          x={32}
          y={222}
          width={356}
          height={24}
          rx={6}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={42} y={235} size={11} tone="muted">
          Web blocks
        </Label>
        <Button x={248} y={258} w={64} h={24} label="Cancel" />
        <Button x={320} y={258} w={68} h={24} label="Save" variant="primary" />
      </Dialog>
    </Scene>
  );
}

function SavedTile({ x, y, title, kind }: { x: number; y: number; title: string; kind: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={84}
        height={70}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {kind === 0 && (
        <g>
          <rect x={x + 12} y={y + 10} width={60} height={30} rx={4} className="fill-brand-100" />
          <TextBar x={x + 18} y={y + 18} w={34} tone="accent" />
          <TextBar x={x + 18} y={y + 28} w={22} tone="faint" />
        </g>
      )}
      {kind === 1 && (
        <g>
          <circle cx={x + 42} cy={y + 25} r={14} className="fill-violet-400" />
          <path
            d={`M${x + 35} ${y + 25}l5 5 9-10`}
            className="fill-none stroke-white"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      )}
      {kind === 2 && (
        <g>
          <rect x={x + 14} y={y + 12} width={56} height={26} rx={13} className="fill-emerald-400" />
          <TextBar x={x + 26} y={y + 22} w={32} tone="faint" />
        </g>
      )}
      <Label x={x + 42} y={y + 56} size={10} tone="body" anchor="middle">
        {title}
      </Label>
    </g>
  );
}

/** The palette's Library: a search over it, a folder per library, and a tile dragged onto the page. */
export function LibraryPanelScene() {
  return (
    <Scene w={420} h={250} bg="canvas">
      <rect
        x={12}
        y={12}
        width={220}
        height={226}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <rect
        x={24}
        y={24}
        width={196}
        height={24}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={34} y={37} size={10} tone="muted">
        Search the library
      </Label>
      <Label x={24} y={66} size={10} weight={700} tone="muted">
        PERSONAL
      </Label>
      <SavedTile x={24} y={74} title="Brand mark" kind={1} />
      <SavedTile x={116} y={74} title="Button" kind={2} />
      <Label x={24} y={166} size={10} weight={700} tone="muted">
        DESIGN TEAM · WEB BLOCKS
      </Label>
      <SavedTile x={24} y={174} title="Hero header" kind={0} />
      <rect
        x={262}
        y={40}
        width={144}
        height={186}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Shape x={276} y={58} w={116} h={46} fill="fill-brand-100" stroke="stroke-brand-300" />
      <TextBar x={288} y={72} w={62} tone="accent" />
      <TextBar x={288} y={84} w={40} tone="faint" />
      <path
        d="M110 214 C 170 224, 230 150, 300 132"
        className="fill-none stroke-brand-400"
        strokeWidth={1.8}
        strokeDasharray="4 4"
      />
      <Label x={334} y={180} size={10} tone="muted" anchor="middle">
        Drag a tile onto
      </Label>
      <Label x={334} y={194} size={10} tone="muted" anchor="middle">
        the page, or click it
      </Label>
    </Scene>
  );
}
