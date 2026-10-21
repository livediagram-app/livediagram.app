// Feature illustration: spreadsheet data coming in (the Sheets entry). Three sources, a CSV, a
// TSV and a paste from Excel, each landing as an editable Sheet. Motion reuses the canvas card timeline (fa-a-* in
// app/feature-art/canvas.css), which settles to the finished frame under reduced motion.
import { Connector, MUTED, Panel, Scene, TEXT, at } from './canvas-parts';

const SOURCES = [
  { name: 'budget.csv', doc: 'Budget', tint: 'fill-emerald-500' },
  { name: 'pipeline.tsv', doc: 'Pipeline', tint: 'fill-sky-500' },
  { name: 'Pasted from Excel', doc: 'Grade book', tint: 'fill-orange-500' },
];

const ROW_H = 22;
const Y0 = 13;

/** Spreadsheet data on the left, arriving as Sheets on the right. */
export function SheetImportArt() {
  return (
    <Scene>
      {SOURCES.map((s, i) => {
        const y = Y0 + i * ROW_H;
        return (
          <g key={s.name}>
            {/* The file, its tool's colour on the folded corner. */}
            <Panel x={22} y={y} w={92} h={16} />
            <rect className={s.tint} x="26" y={y + 4} width="6" height="8" rx="1" />
            <text className={TEXT} x="37" y={y + 10.6} fontSize="6.4" fontWeight="600">
              {s.name}
            </text>
            <g className="fa-a-in" style={at(0.2 + i * 0.25)}>
              <Connector d={`M118 ${y + 8} H 170`} head={`M166 ${y + 5} l4 3 l-4 3`} />
            </g>
            {/* The Sheet it becomes. */}
            <g className="fa-a-pop" style={at(0.4 + i * 0.25)}>
              <Panel x={176} y={y} w={104} h={16} />
              <rect
                className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
                x="181"
                y={y + 4}
                width="12"
                height="8"
                rx="2"
                strokeWidth="1"
              />
              <text className={TEXT} x="198" y={y + 10.6} fontSize="6.4" fontWeight="600">
                {s.doc}
              </text>
              <text className={MUTED} x="274" y={y + 10.6} fontSize="5.6" textAnchor="end">
                Editable
              </text>
            </g>
          </g>
        );
      })}
    </Scene>
  );
}
