// The Community search box in liveplanner (collaboration/sharing/finding-community-documents): the query, the clear
// cross, My Shares, Category, Tags and the sort inside its right edge, over result cards that show plans' boards.

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { MiniBoard } from './board-fragment';

/** The Community search box: the query as words, the clear cross after them, and My Shares,
 *  Category, Tags (a chosen tag counted) and the sort inside its right edge. */
export function CommunitySearchBox({ query }: { query: string }) {
  // The clear cross sits just after the text, however long it is.
  const clearX = Math.round(44 + query.length * 5.4);
  const chip = (cx: number, label: string, on = false, badge = 0) => (
    <g>
      <rect
        x={cx}
        y={34}
        width={label.length * 5.4 + 12 + (badge ? 13 : 0)}
        height={24}
        rx={7}
        className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-200'}
        strokeWidth={0.75}
      />
      <Label x={cx + 6} y={47} size={9.5} weight={600} tone={on ? 'accent' : 'body'}>
        {label}
      </Label>
      {badge ? (
        <g>
          <circle cx={cx + label.length * 5.4 + 15} cy={46} r={5.5} className="fill-brand-500" />
          <Label
            x={cx + label.length * 5.4 + 15}
            y={47}
            anchor="middle"
            size={8}
            weight={700}
            tone="onAccent"
          >
            {badge}
          </Label>
        </g>
      ) : null}
    </g>
  );
  return (
    <Scene w={420} h={176} bg="plain">
      <rect
        x={10}
        y={26}
        width={400}
        height={40}
        rx={12}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <circle cx={28} cy={45} r={5} className="fill-none stroke-slate-400" strokeWidth={1.5} />
      <path d="M32 49 l4 4" className="stroke-slate-400" strokeWidth={1.5} />
      <Label x={44} y={47} size={11} tone="strong">
        {query}
      </Label>
      {/* The clear cross sits just after the text. */}
      <path
        d={`M${clearX} 42 l6 6 M${clearX + 6} 42 l-6 6`}
        className="stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {chip(156, 'My Shares')}
      {chip(222, 'Category')}
      {chip(282, 'Tags', true, 1)}
      {chip(333, 'Most Loved', true)}
      {/* A few result cards. */}
      {[10, 144, 278].map((cx, i) => (
        <g key={cx}>
          <rect
            x={cx}
            y={82}
            width={132}
            height={84}
            rx={10}
            className="fill-white stroke-slate-200"
            strokeWidth={0.75}
          />
          <MiniBoard
            x={cx + 8}
            y={90}
            w={116}
            h={40}
            cols={[3, 4, 3][i]}
            className="fill-slate-50"
          />
          <Label x={cx + 10} y={141} size={10} weight={600} tone="strong">
            {['Sprint board', 'Two-week sprint', 'Sprint retro'][i]}
          </Label>
          <Label x={cx + 10} y={156} size={10} tone="muted">
            {['♥ 48', '♥ 31', '♥ 17'][i]}
          </Label>
          <Label x={cx + 122} y={156} anchor="end" size={10} tone="muted">
            {['Copied 9', 'Copied 4', 'Copied 2'][i]}
          </Label>
        </g>
      ))}
    </Scene>
  );
}
