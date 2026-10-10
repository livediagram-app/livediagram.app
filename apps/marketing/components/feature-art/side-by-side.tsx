// Feature illustration: Side by Side tabs (the Diagrams category's Tabs group). Two tabs of one
// document on screen at once, the right pane sliding in from the edge where its tab was dropped.
// Motion reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css), which
// settles to the finished frame under reduced motion.
import {
  ALEX,
  Box,
  Connector,
  Panel,
  RULE,
  SAM,
  Scene,
  Tab,
  TextBar,
  YOU,
  at,
} from './canvas-parts';

/** Two tabs at once: the diagram on the left, its notes opening beside it on the right. */
export function SideBySideArt() {
  return (
    <Scene>
      <Panel x={12} y={8} w={276} h={80} />
      <rect className="fill-(--art-paper)" x="13" y="9" width="274" height="60" rx="5" />
      {/* Left pane: the tab already open. */}
      <Box x={26} y={22} w={44} h={20} label="Web" />
      <Connector d="M70 32 H 88" head="M84 29 l4 3 l-4 3" />
      <Box x={90} y={22} w={44} h={20} label="API" />
      <Connector d="M112 42 V 50" head="M109 46 l3 4 l3 -4" />
      <Box x={90} y={50} w={44} h={14} label="DB" />
      {/* The divider and the right pane, arriving from the edge. */}
      <g className="fa-a-in" style={at(0.3)}>
        <path className={RULE} d="M150 9 V69" strokeWidth="1" />
        <rect x="150" y="9" width="137" height="2" className="fill-brand-500/60" />
        <TextBar x={164} y={22} w={70} />
        <TextBar x={164} y={30} w={96} />
        <TextBar x={164} y={38} w={84} />
        <TextBar x={164} y={46} w={60} />
        <TextBar x={164} y={54} w={78} />
      </g>
      {/* The tab bar: the right pane's tab carries the same colour as its pane. */}
      <Tab x={18} w={52} name="Systems" color={YOU} />
      <Tab x={74} w={44} name="Notes" color={ALEX} />
      <Tab x={122} w={44} name="Plan" color={SAM} />
    </Scene>
  );
}
