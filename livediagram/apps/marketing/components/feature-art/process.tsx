// Feature illustrations for the notations and the system views of the Diagrams category: a BPMN
// process in its pools and the C4 model's three linked levels. All on the 300 by 96 stage of
// ./canvas-parts, moving on the shared canvas timeline (fa-a-* in app/feature-art/canvas.css),
// which settles to the finished frame under reduced motion (the "out" half of a swap hidden).
import type { CSSProperties } from 'react';
import { Connector, RULE, Scene, Tab, at } from './canvas-parts';

// The BPMN Process template's own look (packages/templates/src/template-builders-bpmn.ts): white faces in slate ink,
// a green start, a red end, and each pool washed in its own colour with its name upright in the gutter.
const BPMN_FACE = 'fill-white dark:fill-slate-800';
const BPMN_INK = 'stroke-slate-700 dark:stroke-slate-300';
const BPMN_INK_FILL = 'fill-slate-700 dark:fill-slate-300';
const BPMN_TEXT = 'fill-slate-700 dark:fill-slate-200';
const BPMN_START = 'stroke-green-600 dark:stroke-green-400';
const BPMN_END = 'stroke-red-600 dark:stroke-red-400';
const POOLS = {
  customer: {
    band: 'fill-purple-50 stroke-purple-300 dark:fill-purple-500/10 dark:stroke-purple-400/50',
    header: 'fill-purple-100 dark:fill-purple-500/20',
    ink: 'fill-purple-800 dark:fill-purple-200',
  },
  shop: {
    band: 'fill-slate-50 stroke-slate-400 dark:fill-slate-500/10 dark:stroke-slate-500',
    header: 'fill-slate-200 dark:fill-slate-500/25',
    ink: 'fill-slate-700 dark:fill-slate-200',
  },
};

/** A pool: its washed band, the gutter down its left and its name upright in the gutter. */
function Pool({
  y,
  h,
  name,
  look,
}: {
  y: number;
  h: number;
  name: string;
  look: (typeof POOLS)[keyof typeof POOLS];
}) {
  return (
    <g>
      <rect className={look.band} x="10" y={y} width="280" height={h} rx="1.5" strokeWidth="0.9" />
      <rect className={look.header} x="10.45" y={y + 0.45} width="11" height={h - 0.9} rx="1" />
      <text
        className={look.ink}
        x="17.6"
        y={y + h / 2}
        fontSize="5.4"
        fontWeight="700"
        textAnchor="middle"
        transform={`rotate(-90 17.6 ${y + h / 2})`}
      >
        {name}
      </text>
    </g>
  );
}

/** A small envelope, the mark of a message event or a send task: filled when it is sent, hollow when caught. */
function Envelope({ x, y, sent = false }: { x: number; y: number; sent?: boolean }) {
  return sent ? (
    <g>
      <rect className={BPMN_INK_FILL} x={x} y={y} width="5" height="3.4" rx="0.4" />
      <path
        className="stroke-white dark:stroke-slate-800"
        d={`M${x + 0.4} ${y + 0.4} l2.1 1.5 l2.1 -1.5`}
        fill="none"
        strokeWidth="0.5"
      />
    </g>
  ) : (
    <g className={BPMN_INK} fill="none" strokeWidth="0.55">
      <rect x={x} y={y} width="5" height="3.4" rx="0.4" />
      <path d={`M${x} ${y} l2.5 1.7 l2.5 -1.7`} />
    </g>
  );
}

/** A task: a rounded white box with its type's mark in the top-left corner and its name. */
function Task({
  x,
  y,
  w,
  label,
  mark,
  className,
  style,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  mark: 'send' | 'user' | 'service';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <g className={className} style={style}>
      <rect
        className={`${BPMN_FACE} ${BPMN_INK}`}
        x={x}
        y={y}
        width={w}
        height="18"
        rx="3"
        strokeWidth="0.9"
      />
      {mark === 'send' ? <Envelope x={x + 2.4} y={y + 2.2} sent /> : null}
      {mark === 'user' ? (
        <g className={BPMN_INK} fill="none" strokeWidth="0.55">
          <circle cx={x + 4.6} cy={y + 3.4} r="1.3" />
          <path d={`M${x + 2.4} ${y + 7} c0 -1.6 1 -2.3 2.2 -2.3 s2.2 0.7 2.2 2.3 z`} />
        </g>
      ) : null}
      {mark === 'service' ? (
        <g className={BPMN_INK} fill="none" strokeWidth="0.55">
          <circle cx={x + 4.6} cy={y + 4.6} r="2.1" strokeDasharray="1 0.6" />
          <circle cx={x + 4.6} cy={y + 4.6} r="0.8" />
        </g>
      ) : null}
      <text
        className={BPMN_TEXT}
        x={x + w / 2}
        y={y + 11.8}
        fontSize="5.6"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

/** An event's circle: thin and green to start, thick and red to end, a double ring in between. */
function BpmnEvent({
  cx,
  cy,
  kind,
  message = false,
}: {
  cx: number;
  cy: number;
  kind: 'start' | 'intermediate' | 'end';
  message?: boolean;
}) {
  const ring = kind === 'start' ? BPMN_START : kind === 'end' ? BPMN_END : BPMN_INK;
  return (
    <g>
      <circle
        className={`${BPMN_FACE} ${ring}`}
        cx={cx}
        cy={cy}
        r="5"
        strokeWidth={kind === 'end' ? 1.8 : 0.9}
      />
      {kind === 'intermediate' ? (
        <circle className={`fill-none ${ring}`} cx={cx} cy={cy} r="3.9" strokeWidth="0.6" />
      ) : null}
      {message ? <Envelope x={cx - 2.5} y={cy - 1.7} sent={kind === 'end'} /> : null}
    </g>
  );
}

/** A sequence flow inside a pool: a solid line with a filled head. */
function Flow({ d, tip }: { d: string; tip: string }) {
  return (
    <g>
      <path className={BPMN_INK} d={d} fill="none" strokeWidth="0.9" strokeLinejoin="round" />
      <path className={BPMN_INK_FILL} d={tip} />
    </g>
  );
}

/** A message flow between the pools: dashed, a small open circle where it leaves, an open head where it lands. */
function MessageFlow({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  const down = y2 > y1;
  const s = down ? 1 : -1;
  return (
    <g className={BPMN_INK} fill="none" strokeWidth="0.8">
      <circle className={`${BPMN_FACE} ${BPMN_INK}`} cx={x} cy={y1 + s * 1.3} r="1.3" />
      <path d={`M${x} ${y1 + s * 2.6} V${y2}`} strokeDasharray="2.4 1.6" />
      <path
        className={`${BPMN_FACE} ${BPMN_INK}`}
        d={`M${x - 2} ${y2 - s * 3} L${x} ${y2} L${x + 2} ${y2 - s * 3} Z`}
      />
    </g>
  );
}

/** The BPMN Process template in little: a customer's pool and the shop's, messages crossing between them, and the
 *  shop's exclusive gateway sending a sold-out order to a message end. */
export function BpmnArt() {
  return (
    <Scene>
      <Pool y={6} h={30} name="Customer" look={POOLS.customer} />
      <Pool y={42} h={48} name="Online Shop" look={POOLS.shop} />

      {/* The customer: wants a lamp, places the order, waits for the parcel. */}
      <g className="fa-a-pop" style={at(0.1)}>
        <BpmnEvent cx={34} cy={21} kind="start" />
      </g>
      <Flow d="M39 21 H48" tip="M48 19.6 L51 21 L48 22.4 Z" />
      <Task
        className="fa-a-pop"
        style={at(0.25)}
        x={51}
        y={12}
        w={42}
        label="Place order"
        mark="send"
      />
      <Flow d="M93 21 H245" tip="M245 19.6 L248 21 L245 22.4 Z" />
      <g className="fa-a-pop" style={at(1.6)}>
        <BpmnEvent cx={253} cy={21} kind="intermediate" message />
      </g>
      <Flow d="M258 21 H271" tip="M271 19.6 L274 21 L271 22.4 Z" />
      <g className="fa-a-pop" style={at(1.75)}>
        <BpmnEvent cx={279} cy={21} kind="end" />
      </g>

      {/* The order crosses to the shop, and the parcel back. */}
      <g className="fa-a-in" style={at(0.4)}>
        <MessageFlow x={72} y1={30} y2={55} />
      </g>
      <g className="fa-a-in" style={at(1.45)}>
        <MessageFlow x={253} y1={51} y2={26} />
      </g>

      {/* The shop: order in, check it, in stock or not. */}
      <g className="fa-a-pop" style={at(0.55)}>
        <BpmnEvent cx={72} cy={60} kind="start" message />
      </g>
      <Flow d="M77 60 H83" tip="M83 58.6 L86 60 L83 61.4 Z" />
      <Task
        className="fa-a-pop"
        style={at(0.7)}
        x={86}
        y={51}
        w={42}
        label="Check order"
        mark="user"
      />
      <Flow d="M128 60 H134" tip="M134 58.6 L137 60 L134 61.4 Z" />
      <g className="fa-a-pop" style={at(0.85)}>
        <path
          className={`${BPMN_FACE} ${BPMN_INK}`}
          d="M145 51.5 L153.5 60 L145 68.5 L136.5 60 Z"
          strokeWidth="0.9"
        />
        <path
          className={BPMN_INK}
          d="M142.4 57.4 L147.6 62.6 M147.6 57.4 L142.4 62.6"
          strokeWidth="1.1"
        />
      </g>
      <text className={BPMN_TEXT} x="145" y="48.6" fontSize="4.8" textAnchor="middle">
        In stock?
      </text>
      <Flow d="M153.5 60 H164" tip="M164 58.6 L167 60 L164 61.4 Z" />
      <text className={BPMN_TEXT} x="159.6" y="57.4" fontSize="4.4" textAnchor="middle">
        Yes
      </text>
      <Task
        className="fa-a-pop"
        style={at(1)}
        x={167}
        y={51}
        w={46}
        label="Take payment"
        mark="service"
      />
      <Flow d="M213 60 H226" tip="M226 58.6 L229 60 L226 61.4 Z" />
      <Task
        className="fa-a-pop"
        style={at(1.2)}
        x={229}
        y={51}
        w={48}
        label="Ship parcel"
        mark="send"
      />

      {/* Sold out: down to a message end. */}
      <Flow d="M145 68.5 V75.4" tip="M143.6 75.4 L145 78.4 L146.4 75.4 Z" />
      <text className={BPMN_TEXT} x="141.4" y="74.6" fontSize="4.4" textAnchor="end">
        No
      </text>
      <g className="fa-a-pop" style={at(1.05)}>
        <BpmnEvent cx={145} cy={83.4} kind="end" message />
      </g>
      <text className={BPMN_TEXT} x="153" y="85.2" fontSize="4.8">
        Sorry, sold out
      </text>
    </Scene>
  );
}

// The C4 kinds' own colours (packages/document/src/c4-look.ts), kept under every theme.
const C4 = {
  person: { fill: '#08427b', ink: '#ffffff' },
  system: { fill: '#1168bd', ink: '#ffffff' },
  container: { fill: '#2f78c4', ink: '#ffffff' },
  component: { fill: '#85bbf0', ink: '#0b2540' },
};

function C4Card({
  x,
  y,
  w,
  kind,
  name,
  meta,
}: {
  x: number;
  y: number;
  w: number;
  kind: keyof typeof C4;
  name: string;
  meta: string;
}) {
  const look = C4[kind];
  return (
    <g>
      <rect x={x} y={y} width={w} height="22" rx="3" fill={look.fill} />
      <text
        x={x + w / 2}
        y={y + 9.6}
        fontSize="6.4"
        fontWeight="700"
        textAnchor="middle"
        fill={look.ink}
      >
        {name}
      </text>
      <text x={x + w / 2} y={y + 17} fontSize="4.8" textAnchor="middle" fill={look.ink}>
        {meta}
      </text>
    </g>
  );
}

/** A C4 boundary as the templates draw one (template-builders-c4.ts c4Boundary): long dashes in the system's blue,
 *  its name bold in the bottom-left corner beside its type in brackets. */
function Boundary({
  x,
  y,
  w,
  h,
  name,
  type,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  type: string;
}) {
  return (
    <g>
      <rect
        className="fill-none stroke-[#1168bd] dark:stroke-[#5aa2ea]"
        x={x}
        y={y}
        width={w}
        height={h}
        rx="3"
        strokeWidth="1"
        strokeDasharray="5 2.5"
      />
      <text className="fill-[#1168bd] dark:fill-[#7db6ef]" x={x + 4} y={y + h - 4} fontSize="5">
        <tspan fontWeight="700">{name}</tspan>
        <tspan fontSize="4.2"> {type}</tspan>
      </text>
    </g>
  );
}

/** The three C4 levels as three tabs, each one opening the next. */
export function C4Art() {
  return (
    <Scene>
      {/* System Context: the customer and the system they use. */}
      <g className="fa-a-pop" style={at(0.1)}>
        <C4Card x={16} y={9} w={70} kind="person" name="Customer" meta="[Person]" />
      </g>
      <g className="fa-a-in" style={at(0.3)}>
        <Connector d="M51 31 V39" head="M48.5 36 l2.5 3 l2.5 -3" />
      </g>
      <g className="fa-a-pop" style={at(0.45)}>
        <C4Card x={16} y={40} w={70} kind="system" name="Lamp Shop" meta="[Software System]" />
      </g>

      <g className="fa-a-in" style={at(0.7)}>
        <Connector d="M88 51 H102" head="M99 48.5 l3 2.5 l-3 2.5" />
      </g>

      {/* Container: inside the Lamp Shop's boundary. */}
      <g className="fa-a-pop" style={at(0.85)}>
        <Boundary x={104} y={5} w={88} h={64} name="Lamp Shop" type="[System]" />
        <C4Card x={112} y={10} w={72} kind="container" name="Web App" meta="[Container: React]" />
        <C4Card x={112} y={35} w={72} kind="container" name="Order API" meta="[Container: Go]" />
      </g>

      <g className="fa-a-in" style={at(1.1)}>
        <Connector d="M186 46 H200" head="M197 43.5 l3 2.5 l-3 2.5" />
      </g>

      {/* Component: inside the Order API container. */}
      <g className="fa-a-pop" style={at(1.25)}>
        <Boundary x={202} y={5} w={86} h={64} name="Order API" type="[Container]" />
        <C4Card x={210} y={10} w={70} kind="component" name="Checkout" meta="[Component]" />
        <C4Card x={210} y={35} w={70} kind="component" name="Payments" meta="[Component]" />
      </g>

      {/* The tabs the levels sit on, the open one underlined. */}
      <path className={RULE} d="M10 72 H290" strokeWidth="1" />
      <Tab x={16} w={70} name="System Context" color="#08427b" />
      <Tab x={104} w={88} name="Containers" color="#2f78c4" />
      <Tab x={202} w={86} name="Components" color="#85bbf0" />
      <rect
        className="fa-a-in"
        style={at(1.25)}
        x="202"
        y="87"
        width="86"
        height="1.6"
        rx="0.8"
        fill="#0ea5e9"
      />
    </Scene>
  );
}
