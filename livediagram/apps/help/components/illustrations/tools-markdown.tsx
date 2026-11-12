// Markdown import (tools.tsx): an outline turning into a tree on the canvas, and the import
// dialog it starts from.

import {
  Scene,
  Shape,
  Arrow,
  Panel,
  Label,
  TextBar,
  Button,
} from '@liveworkspace/help-site/art/primitives';

// --- Markdown import --------------------------------------------------------

/** A Markdown outline on the left turning into a themed left-to-right tree on
 *  the right. */
export function MarkdownToTree() {
  const lines: [number, number][] = [
    // A heading and its three bullets: the Root and its children A, B and C.
    [0, 92],
    [12, 70],
    [12, 58],
    [12, 78],
  ];
  return (
    <Scene w={420} h={220}>
      {/* Markdown source card */}
      <Panel x={20} y={36} w={150} h={148} title="OUTLINE.MD">
        {lines.map(([indent, w], i) => (
          <g key={i}>
            <Label
              x={32 + indent}
              y={72 + i * 18}
              size={10}
              weight={i === 0 ? 700 : 400}
              tone={i === 0 ? 'strong' : 'muted'}
            >
              {i === 0 ? '#' : '-'}
            </Label>
            <TextBar x={44 + indent} y={68 + i * 18} w={w} tone={i === 0 ? 'muted' : 'faint'} />
          </g>
        ))}
      </Panel>
      <Arrow from={[176, 110]} to={[214, 110]} kind="curved" tone="muted" dashed />
      {/* Themed tree, left-to-right */}
      <Shape x={224} y={92} w={56} h={34} accent label="Root" />
      <Shape
        x={310}
        y={36}
        w={56}
        h={30}
        fill="fill-brand-100"
        stroke="stroke-brand-400"
        label="A"
      />
      <Shape
        x={310}
        y={94}
        w={56}
        h={30}
        fill="fill-brand-100"
        stroke="stroke-brand-400"
        label="B"
      />
      <Shape
        x={310}
        y={152}
        w={56}
        h={30}
        fill="fill-brand-100"
        stroke="stroke-brand-400"
        label="C"
      />
      {/* Curved arrows, as the import draws them: out of the root's east side, into each child's
          west side, leaving and arriving level so every arrowhead points straight in. */}
      {[51, 109, 167].map((cy) => (
        <g key={cy}>
          <path
            d={`M280 109 C296 109 288 ${cy} 302 ${cy}`}
            className="fill-none stroke-brand-400"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Arrow from={[300, cy]} to={[310, cy]} />
        </g>
      ))}
    </Scene>
  );
}

// --- Markdown import (dialog) ----------------------------------------------

/** The Import to Tab dialog on its Markdown step: the replace warning, the
 *  All formats back bar with the chosen format, the paste box, and the two
 *  ways to import. */
export function MarkdownImportPanel() {
  const lines = ['# Project', '- Research', '  - Interviews', '- Build', '- Launch'];
  return (
    <Scene w={420} h={240} bg="none">
      <rect
        x={20}
        y={8}
        width={380}
        height={224}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={36} y={28} size={13} weight={700} tone="strong">
        Import to Tab
      </Label>
      <Label x={36} y={44} size={10} tone="muted">
        Paste your Markdown, or import a file.
      </Label>
      {/* Replace warning */}
      <rect
        x={36}
        y={56}
        width={348}
        height={24}
        rx={6}
        className="fill-amber-400/15 stroke-amber-400"
        strokeWidth={1}
      />
      <Label x={48} y={69} size={10} className="fill-slate-700">
        This replaces everything on Tab 1 with the imported content.
      </Label>
      {/* Back bar with the chosen format as its chip */}
      <Label x={36} y={98} size={10} weight={600} tone="body">
        ‹ All formats
      </Label>
      <rect x={112} y={89} width={66} height={18} rx={9} className="fill-brand-50" />
      <Label x={145} y={99} size={10} weight={600} tone="accent" anchor="middle">
        Markdown
      </Label>
      {/* Paste box */}
      <rect
        x={36}
        y={114}
        width={348}
        height={78}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      {lines.map((l, i) => (
        <Label key={l} x={48} y={126 + i * 14} size={10} tone={i === 0 ? 'strong' : 'body'}>
          {l.replace(/^ +/, (m) => ' '.repeat(m.length * 2))}
        </Label>
      ))}
      <Button x={168} y={200} w={138} h={24} label="Import a file instead" variant="ghost" />
      <Button x={312} y={200} w={72} h={24} label="Import" variant="primary" />
    </Scene>
  );
}
