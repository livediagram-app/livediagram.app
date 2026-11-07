// The Community scenes for every app's Sharing to the Community and Finding <Things> in the Community articles
// (liveworkspace/docs/specs/007-community/community.md "Every app's Community"): the Share dialog's Community tab with
// a listed post, and the gallery's one search box. Each app passes its own post title, category and query. Labels
// are the real UI strings.

import { Button, Label, Scene, Shape, TextBar } from '../primitives';

/** The Share dialog's Community tab with a listed post: View Post, Edit Listing and
 *  Remove From Community. */
export function CommunityShareSection({
  title,
  meta,
}: {
  // The post's title, in the app's words.
  title: string;
  // Its category, likes and copies, as the tab prints them ("Flows & Processes · ♥ 12 · Copied 3 times").
  meta: string;
}) {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={170} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={154}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {/* The dialog's two tabs, Community chosen. */}
      <Label x={x + 20} y={28} size={11} weight={500} tone="muted">
        Passes
      </Label>
      <Label x={x + 76} y={28} size={11} weight={700} tone="accent">
        Community
      </Label>
      <line x1={x + 72} y1={37} x2={x + 140} y2={37} className="stroke-brand-500" strokeWidth={2} />
      <line
        x1={x + 1}
        y1={38}
        x2={x + w - 1}
        y2={38}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <rect
        x={x + 16}
        y={44}
        width={w - 32}
        height={106}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 30} y={64} size={12} weight={600} tone="strong">
        {title}
      </Label>
      <Label x={x + 30} y={84} size={10} tone="muted">
        {meta}
      </Label>
      <Button x={x + 30} y={108} w={78} h={26} label="View Post" />
      <Button x={x + 116} y={108} w={88} h={26} label="Edit Listing" />
      <Button x={x + 212} y={108} w={150} h={26} label="Remove From Community" />
    </Scene>
  );
}

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
        strokeWidth={1.2}
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
        strokeWidth={1.5}
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
            strokeWidth={1.5}
          />
          <rect x={cx + 8} y={90} width={116} height={40} rx={6} className="fill-slate-50" />
          <Shape x={cx + 20} y={98} w={36} h={24} accent={i === 0} />
          <Shape x={cx + 76} y={98} w={36} h={24} kind="circle" />
          <TextBar x={cx + 10} y={140} w={84} tone="muted" />
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
