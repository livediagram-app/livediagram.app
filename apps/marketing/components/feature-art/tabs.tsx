// Feature illustrations: tab links and tab folders (the Diagrams category's tab cards), split from
// ./canvas. Same stage and motion as ./canvas: app/feature-art/canvas.css, settling under reduced motion.

import {
  ALEX,
  AWAY,
  Box,
  Connector,
  FOLDER_PATHS,
  Glyph,
  JORDAN,
  LINK_PATHS,
  Panel,
  Pointer,
  RULE,
  SAM,
  Scene,
  Tab,
  TextBar,
  YOU,
  at,
  from,
} from './canvas-parts';

/* ───────────────────────── Tabs ───────────────────────── */

/** Link an element to another tab: a press on its link lands you there. */
export function TabsArt() {
  return (
    <Scene>
      <Panel x={12} y={8} w={276} h={80} />
      <rect className="fill-(--art-paper)" x="13" y="9" width="274" height="60" rx="5" />
      {/* Backend tab's canvas. */}
      <g className="fa-a-out" style={at(0.6)}>
        <Box x={36} y={30} w={56} h={22} label="Auth" />
        <Connector d="M92 41 H 116" head="M112 38 l4 3 l-4 3" />
        <Box x={118} y={30} w={60} h={22} label="Gateway" />
        <Connector d="M178 41 H 202" head="M198 38 l4 3 l-4 3" />
        <Box x={204} y={30} w={56} h={22} label="Queue" />
        <rect
          className="fill-white stroke-sky-300 dark:fill-slate-800 dark:stroke-sky-500/60"
          x="160"
          y="18"
          width="40"
          height="12"
          rx="6"
          strokeWidth="1"
        />
        <Glyph x={164} y={19.2} className="stroke-sky-600 dark:stroke-sky-300" scale={0.9}>
          {LINK_PATHS}
        </Glyph>
        <text
          className="fill-sky-700 dark:fill-sky-200"
          x="175"
          y="26.6"
          fontSize="6.5"
          fontWeight="600"
        >
          Data
        </text>
      </g>
      {/* Data tab's canvas: two tables and the key between them. */}
      <g className="fa-a-late" style={at(0.6)}>
        {(
          [
            [76, 'users'],
            [168, 'orders'],
          ] as const
        ).map(([x, name]) => (
          <g key={name}>
            <rect
              className="fill-violet-50 stroke-violet-500 dark:fill-violet-500/15 dark:stroke-violet-300"
              x={x}
              y="20"
              width="60"
              height="40"
              rx="4"
              strokeWidth="1.5"
            />
            <path
              className="fill-violet-500 dark:fill-violet-400"
              d={`M${x + 4} 20 h52 a4 4 0 0 1 4 4 v7 h-60 v-7 a4 4 0 0 1 4 -4 z`}
            />
            <text
              x={x + 30}
              y="28.2"
              fontSize="6.5"
              fontWeight="700"
              textAnchor="middle"
              fill="#fff"
            >
              {name}
            </text>
            {[38, 46, 54].map((y) => (
              <g key={y}>
                <TextBar
                  x={x + 6}
                  y={y - 2}
                  w={22}
                  className="fill-violet-200 dark:fill-violet-400/40"
                />
                <TextBar
                  x={x + 36}
                  y={y - 2}
                  w={16}
                  className="fill-violet-200 dark:fill-violet-400/40"
                />
              </g>
            ))}
          </g>
        ))}
        <path className="stroke-violet-400" d="M136 44 H 168" strokeWidth="1.3" fill="none" />
        <circle className="fill-violet-500" cx="136" cy="44" r="1.8" />
      </g>
      <path className={RULE} d="M13 69.5 H 287" strokeWidth="1" />
      <Tab x={18} w={52} name="Backend" color={YOU} />
      <Tab x={74} w={40} name="Data" color={ALEX} />
      <Tab x={118} w={50} name="Roadmap" color={SAM} />
      <Tab x={172} w={40} name="Notes" color={AWAY} />
      <rect
        className="fa-a-out fill-sky-500"
        style={at(0.6)}
        x="22"
        y="85"
        width="42"
        height="1.6"
        rx="0.8"
      />
      <rect
        className="fa-a-late fill-violet-500"
        style={at(0.6)}
        x="78"
        y="85"
        width="30"
        height="1.6"
        rx="0.8"
      />
      <g className="fa-a-out" style={at(0.6)}>
        <Pointer x={182} y={26} color={YOU} className="fa-a-move" style={from(-50, 36, 0)} />
      </g>
    </Scene>
  );
}

/** Tab folders: a named folder on the tab bar folds its tabs away and opens them again. */
export function TabFoldersArt() {
  const bar = (open: boolean) => (
    <g>
      <rect
        className="fill-sky-50 stroke-sky-200 dark:fill-sky-500/10 dark:stroke-sky-500/40"
        x="22"
        y="38"
        width={open ? 140 : 60}
        height="20"
        rx="5"
        strokeWidth="1"
      />
      <Glyph
        x={27}
        y={43}
        className="fill-sky-200 stroke-sky-600 dark:fill-sky-500/30 dark:stroke-sky-300"
      >
        {FOLDER_PATHS}
      </Glyph>
      <text
        className="fill-sky-800 dark:fill-sky-100"
        x="39"
        y="50.6"
        fontSize="7"
        fontWeight="700"
      >
        Backend
      </text>
      <path
        className="stroke-sky-600 dark:stroke-sky-300"
        d={open ? 'M73 46 l2.5 2.5 l2.5 -2.5' : 'M74 45 l2.5 2.5 l-2.5 2.5'}
        fill="none"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {open ? (
        <>
          <Tab x={84} w={24} name="Auth" color={ALEX} y={40} />
          <Tab x={108} w={24} name="API" color={AWAY} y={40} />
          <Tab x={130} w={30} name="Jobs" color={YOU} y={40} />
        </>
      ) : null}
      <Tab x={open ? 168 : 88} w={34} name="Notes" color={SAM} y={40} />
      <Tab x={open ? 202 : 122} w={30} name="Docs" color={JORDAN} y={40} />
      <Tab x={open ? 234 : 154} w={40} name="Roadmap" color={ALEX} y={40} />
    </g>
  );
  return (
    <Scene>
      <Panel x={12} y={32} w={276} h={32} />
      <g className="fa-a-out" style={at(0.2)}>
        {bar(true)}
      </g>
      <g className="fa-a-late" style={at(0.2)}>
        {bar(false)}
      </g>
      <Pointer x={75} y={50} color={YOU} className="fa-a-move" style={from(60, 26, 0)} />
    </Scene>
  );
}
