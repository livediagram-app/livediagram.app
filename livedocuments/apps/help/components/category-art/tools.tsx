import { Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Shadow } from '@liveworkspace/help-site/art/parts';
import { ToolsArt as Scene } from '@liveworkspace/help-site/art/scenes/tools';

const MONO = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  whiteSpace: 'pre',
} as const;

// The Markdown pasted into the Import box, one line each.
const MARKDOWN = ['# Launch plan', '- Goals', '- [x] Brief'];

// Tools: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with livedocuments's helper: Markdown
// Import (the tab menu's Import, then Markdown) turning `#`, `-` and `- [x]` lines into an article's heading, bullet
// and ticked to-do, beside the shared appearance switch and Zen mode.
export function ToolsArt() {
  return (
    <Scene>
      {/* The Import box. */}
      <Card x={22} y={22} w={200} h={78} r={12}>
        <Label x={34} y={38} size={10.5} weight={700} tone="strong">
          Import Markdown
        </Label>
        <rect
          x={32}
          y={48}
          width={124}
          height={44}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        {MARKDOWN.map((line, i) => (
          <text
            key={line}
            x={40}
            y={58 + i * 12}
            fontSize={8.5}
            dominantBaseline="middle"
            className={i === 0 ? 'fill-brand-600' : 'fill-slate-600'}
            style={MONO}
          >
            {line}
          </text>
        ))}
        <rect x={164} y={60} width={48} height={22} rx={6} className="fill-brand-500" />
        <Label x={188} y={71.5} anchor="middle" size={9} weight={700} tone="onAccent">
          Import
        </Label>
      </Card>
      <path
        d="M226 62 C238 62 242 48 252 44"
        className="fill-none stroke-brand-300"
        strokeWidth={1.6}
        strokeDasharray="3 4"
        strokeLinecap="round"
      />

      {/* The article it becomes. */}
      <Shadow x={256} y={18} w={128} h={176} r={6} />
      <rect
        x={256}
        y={18}
        width={128}
        height={176}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={270} y={40} size={13} weight={800} tone="strong">
        Launch plan
      </Label>
      <rect x={270} y={52} width={100} height={4} rx={2} className="fill-slate-200" />
      <rect x={270} y={61} width={84} height={4} rx={2} className="fill-slate-200" />
      <circle cx={273} cy={80} r={2.2} className="fill-slate-500" />
      <Label x={281} y={80.5} size={9.5} weight={500} tone="body">
        Goals
      </Label>
      <rect
        x={268}
        y={92}
        width={10}
        height={10}
        rx={2.5}
        className="fill-brand-500 stroke-brand-500"
      />
      <path
        d="M270.5 97 l2 2 3.5 -4"
        className="fill-none stroke-white help-art-as-drawn"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={284} y={97.5} size={9.5} weight={500} className="fill-slate-400 line-through">
        Brief
      </Label>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={270}
          y={118 + i * 11}
          width={i === 4 ? 60 : 100}
          height={4}
          rx={2}
          className="fill-slate-200"
        />
      ))}
    </Scene>
  );
}
