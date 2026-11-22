// The liveworkspace page's card drawings (docs/specs/019-marketing/marketing-site.md "Feature pages", `workspace`):
// live embeds, the three roles, Knowledgebase Style, Offline, the Google Drive mirror and one account.
import { Avatar, Bars, Button, PageGlyph, Pill, Scene, Sheet, Tick, Txt, at } from './kit';

/** A page with a diagram and a board embedded, each as it is now. */
export function EmbedsArt() {
  return (
    <Scene>
      <Sheet x={20} y={6} w={260} h={84}>
        <Txt x={30} y={20} size={7} weight={700}>
          How a Release Ships
        </Txt>
        <Bars x={30} y={27} widths={[180]} />
        <Sheet x={30} y={36} w={116} h={46}>
          <g
            strokeWidth={0.9}
            className="kb-in fill-sky-50 stroke-sky-500 dark:fill-sky-950 dark:stroke-sky-400"
            style={at(0.4)}
          >
            <rect x={38} y={52} width={22} height={13} rx={3} />
            <path d="M88 50 L98 58.5 L88 67 L78 58.5 Z" />
            <rect x={116} y={52} width={22} height={13} rx={3} />
          </g>
          <path d="M60 58.5 H 76 M100 58.5 H 114" strokeWidth={0.9} className="stroke-slate-400" />
          <Txt x={38} y={46} size={5.4} weight={700} tone="quiet">
            livediagram · live
          </Txt>
        </Sheet>
        <Sheet x={154} y={36} w={116} h={46}>
          <Txt x={162} y={46} size={5.4} weight={700} tone="quiet">
            liveplanner · live
          </Txt>
          {[0, 1, 2].map((c) => (
            <g key={c} className="kb-in" style={at(0.7 + c * 0.2)}>
              <rect
                x={162 + c * 35}
                y={51}
                width={31}
                height={26}
                rx={3}
                className="fill-slate-100 dark:fill-slate-700"
              />
              <rect
                x={165 + c * 35}
                y={55}
                width={25}
                height={7}
                rx={1.5}
                className="fill-white dark:fill-slate-800"
              />
              {c < 2 ? (
                <rect
                  x={165 + c * 35}
                  y={65}
                  width={25}
                  height={7}
                  rx={1.5}
                  className="fill-white dark:fill-slate-800"
                />
              ) : null}
            </g>
          ))}
        </Sheet>
      </Sheet>
    </Scene>
  );
}

/** The share dialog's three roles, and what each may do. */
export function RolesArt() {
  const roles = [
    { r: 'Editor', d: 'Everything, settings and sharing too', f: 'fill-violet-500', i: 'P' },
    { r: 'Participant', d: 'Writes, verifies, imports', f: 'fill-sky-500', i: 'S' },
    { r: 'Viewer', d: 'Reads, searches, asks', f: 'fill-emerald-600', i: 'A' },
  ];
  return (
    <Scene>
      <Sheet x={30} y={6} w={240} h={84}>
        {roles.map((x, i) => (
          <g key={x.r} className="kb-in" style={at(0.3 + i * 0.3)}>
            <Avatar cx={44} cy={22 + i * 25} r={6} fill={x.f} initial={x.i} />
            <Txt x={56} y={20 + i * 25} size={6.6} weight={700}>
              {x.r}
            </Txt>
            <Txt x={56} y={29 + i * 25} size={5.6} weight={500} tone="quiet">
              {x.d}
            </Txt>
            <Pill x={206} y={15.5 + i * 25} w={54} tone={i ? 'plain' : 'brand'}>
              {x.r}
            </Pill>
          </g>
        ))}
      </Sheet>
    </Scene>
  );
}

/** Knowledgebase Style: looks drawn as small pages of writing, one chosen for every page at once. */
export function StyleArt() {
  const looks = [
    { name: 'Lime', ground: 'fill-brand-50 dark:fill-brand-950', accent: 'fill-brand-600' },
    { name: 'Steel', ground: 'fill-slate-100 dark:fill-slate-700', accent: 'fill-sky-600' },
    { name: 'Lavender', ground: 'fill-violet-50 dark:fill-violet-950', accent: 'fill-violet-600' },
    { name: 'Rose', ground: 'fill-rose-50 dark:fill-rose-950', accent: 'fill-rose-600' },
  ];
  return (
    <Scene>
      {looks.map((l, i) => (
        <g key={l.name}>
          <rect
            x={16 + i * 70}
            y={10}
            width={62}
            height={66}
            rx={5}
            strokeWidth={i === 0 ? 1.4 : 0.8}
            className={`${l.ground} ${i === 0 ? 'stroke-brand-700 dark:stroke-brand-300' : 'stroke-slate-200 dark:stroke-slate-600'}`}
          />
          <rect x={24 + i * 70} y={18} width={34} height={4} rx={2} className={l.accent} />
          <Bars x={24 + i * 70} y={28} widths={[44, 38, 46]} />
          <rect
            x={24 + i * 70}
            y={52}
            width={46}
            height={14}
            rx={2}
            className="fill-white/70 dark:fill-slate-800/70"
          />
          <Txt x={47 + i * 70} y={88} size={6} weight={i === 0 ? 700 : 500} anchor="middle">
            {l.name}
          </Txt>
        </g>
      ))}
      <Tick cx={72} cy={16} r={4} delay={1} />
    </Scene>
  );
}

/** A knowledgebase kept Offline: in the browser, written, searched and exported with no account. */
export function OfflineArt() {
  return (
    <Scene>
      <rect
        x={30}
        y={6}
        width={240}
        height={84}
        rx={6}
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        strokeWidth={0.9}
      />
      <path d="M30 18 H 270" strokeWidth={0.8} className="stroke-slate-200 dark:stroke-slate-600" />
      {['fill-rose-300', 'fill-yellow-300', 'fill-emerald-300'].map((f, i) => (
        <circle key={f} cx={38 + i * 7} cy={12} r={2} className={f} />
      ))}
      <Pill x={196} y={24} w={66} tone="plain">
        Offline
      </Pill>
      <PageGlyph x={40} y={26} />
      <Txt x={50} y={32.5} size={6.6} weight={700}>
        My Notes
      </Txt>
      <Bars x={40} y={42} widths={[200, 170, 190]} />
      <Txt x={40} y={74} size={5.8} weight={500} tone="quiet">
        Kept in this browser. No account needed to write, search or export.
      </Txt>
    </Scene>
  );
}

/** The Google Drive mirror: the knowledgebase, kept as a file in your own Drive. */
export function DriveArt() {
  return (
    <Scene>
      <Sheet x={30} y={18} w={100} h={60} lime>
        <Txt x={40} y={34} size={6.6} weight={700}>
          Team Handbook
        </Txt>
        <Bars x={40} y={42} widths={[70, 58, 64]} />
      </Sheet>
      <path
        d="M138 48 H 164"
        strokeWidth={1.1}
        strokeDasharray="3 3"
        className="kb-link stroke-brand-600 dark:stroke-brand-400"
      />
      {/* Drive's three-colour triangle, drawn simply. */}
      <g transform="translate(176 26)">
        <path d="M14 0 H 30 L 44 24 H 28 Z" className="fill-yellow-400" />
        <path d="M14 0 L 0 24 L 8 38 L 22 14 Z" className="fill-emerald-500" />
        <path d="M8 38 H 36 L 44 24 H 16 Z" className="fill-sky-500" />
      </g>
      <Txt x={198} y={78} size={6} weight={600} anchor="middle">
        Your Drive
      </Txt>
      <Button x={228} y={42} w={56}>
        Mirrored
      </Button>
    </Scene>
  );
}

/** One account across every app: a person, and the six apps they open with it. */
export function OneAccountArt() {
  const apps = [
    { n: 'knowledge', f: 'fill-brand-500' },
    { n: 'diagram', f: 'fill-sky-500' },
    { n: 'planner', f: 'fill-violet-500' },
    { n: 'design', f: 'fill-rose-500' },
    { n: 'huddle', f: 'fill-emerald-500' },
  ];
  return (
    <Scene>
      <Avatar cx={44} cy={48} r={14} fill="fill-violet-500" initial="P" />
      <Txt x={44} y={74} size={6} weight={600} anchor="middle">
        Priya
      </Txt>
      {apps.map((a, i) => (
        <g key={a.n} className="kb-in" style={at(0.3 + i * 0.2)}>
          <path
            d={`M60 48 C 90 48, 90 ${14 + i * 17}, 116 ${14 + i * 17}`}
            fill="none"
            strokeWidth={0.9}
            className="stroke-slate-300 dark:stroke-slate-600"
          />
          <rect x={120} y={8 + i * 17} width={12} height={12} rx={3} className={a.f} />
          <Txt x={138} y={17 + i * 17} size={6.6} weight={600}>
            {`live${a.n}`}
          </Txt>
        </g>
      ))}
    </Scene>
  );
}
