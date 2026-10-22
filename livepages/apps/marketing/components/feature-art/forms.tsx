// Feature illustrations: Forms (docs/specs/030-forms/forms.md), the Forms category's cards. A form built in place, a
// link anyone can fill it in from, and its responses landing as rows in a sheet or cards on a board. Motion reuses the
// canvas card timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished frame under reduced
// motion.
import { MUTED, Panel, RULE, Scene, TEXT, at } from './canvas-parts';

const ACCENT = '#7c3aed';

// A small form card: its cover band, heading and two questions, the second selected with its accent bar.
function FormCard({ x, y, selected = false }: { x: number; y: number; selected?: boolean }) {
  return (
    <>
      <Panel x={x} y={y} w={96} h={76} />
      <path
        d={`M${x} ${y + 6}A6 6 0 0 1 ${x + 6} ${y}H${x + 90}A6 6 0 0 1 ${x + 96} ${y + 6}V${y + 12}H${x}Z`}
        fill="#c4b5fd"
      />
      <rect className={TEXT} x={x + 8} y={y + 18} width="44" height="4" rx="2" />
      <rect className={MUTED} x={x + 8} y={y + 30} width="26" height="2.5" rx="1.2" />
      <rect
        className={RULE}
        x={x + 8}
        y={y + 35}
        width="80"
        height="9"
        rx="2"
        fill="none"
        strokeWidth="0.8"
      />
      {selected ? <rect x={x} y={y + 48} width="2.5" height="24" fill={ACCENT} /> : null}
      <rect className={MUTED} x={x + 8} y={y + 52} width="32" height="2.5" rx="1.2" />
      {[0, 1].map((k) => (
        <circle
          key={k}
          cx={x + 12 + k * 28}
          cy={y + 64}
          r="3"
          fill="none"
          className={RULE}
          strokeWidth="0.9"
        />
      ))}
      <circle cx={x + 12} cy={y + 64} r="1.6" fill={ACCENT} />
    </>
  );
}

/** A form built where it sits: click a question to word it, pick its type and say where its answer goes. */
export function FormBuilderArt() {
  return (
    <Scene>
      <FormCard x={30} y={10} selected />
      {/* The selected question's settings, beside it. */}
      <g className="fa-a-in" style={at(0)}>
        <Panel x={140} y={38} w={130} h={46} />
        <text className={TEXT} x={150} y={52} fontSize="6.6" fontWeight="700">
          Coming?
        </text>
        <rect
          x={210}
          y={45}
          width="52"
          height="10"
          rx="3"
          fill="none"
          className={RULE}
          strokeWidth="0.8"
        />
        <text className={MUTED} x={215} y={52.4} fontSize="5.6">
          Single Choice
        </text>
        <text className={MUTED} x={150} y={70} fontSize="5.6">
          Answer goes to
        </text>
        <rect x={194} y={63} width="68" height="10" rx="5" fill={ACCENT} fillOpacity="0.12" />
        <text x={199} y={70.2} fontSize="5.6" fontWeight="600" fill={ACCENT}>
          Attending field
        </text>
      </g>
      <path
        className="fa-a-late"
        style={at(0.3)}
        d="M126 64L140 60"
        stroke={ACCENT}
        strokeWidth="1"
      />
    </Scene>
  );
}

/** One link to share: anyone fills it in, with no account and nothing else of yours to see. */
export function FormShareArt() {
  return (
    <Scene>
      <FormCard x={170} y={10} />
      <g className="fa-a-in" style={at(0)}>
        <Panel x={20} y={30} w={130} h={36} />
        <text className={MUTED} x={30} y={44} fontSize="5.6" fontWeight="600">
          FORM LINK
        </text>
        <text className={TEXT} x={30} y={57} fontSize="6.4" fontFamily="ui-monospace, monospace">
          livepages.app/f/7Kq2…
        </text>
        <rect x={118} y={49} width="26" height="11" rx="5.5" fill={ACCENT} />
        <text x={131} y={56.6} fontSize="5.6" fontWeight="700" fill="#ffffff" textAnchor="middle">
          Copy
        </text>
      </g>
      <path
        className="fa-a-late"
        style={at(0.3)}
        d="M150 48C158 48 160 40 168 40"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </Scene>
  );
}

/** Every response lands: a row in a sheet, or a card on a board, the moment it is sent. */
export function FormResponsesArt() {
  const rows = ['Ada · Yes', 'Ben · Maybe', 'Sam · Yes · Vegan'];
  return (
    <Scene>
      <FormCard x={20} y={10} />
      <path d="M122 48H146" stroke={ACCENT} strokeWidth="1.2" />
      <path d="M142 44L147 48L142 52" fill="none" stroke={ACCENT} strokeWidth="1.2" />
      <Panel x={156} y={14} w={124} h={68} />
      <rect
        className="fill-slate-100 dark:fill-slate-700/60"
        x={156}
        y={14}
        width="124"
        height="12"
        rx="6"
      />
      <text className={MUTED} x={164} y={22.4} fontSize="5.6" fontWeight="700">
        Responses
      </text>
      {rows.map((r, i) => (
        <g
          key={r}
          className={i === rows.length - 1 ? 'fa-a-late' : undefined}
          style={i === rows.length - 1 ? at(0.4) : undefined}
        >
          {i === rows.length - 1 ? (
            <rect x={157} y={30 + i * 15} width="122" height="13" fill={ACCENT} fillOpacity="0.1" />
          ) : null}
          <text className={TEXT} x={164} y={39 + i * 15} fontSize="6.2">
            {r}
          </text>
          <path className={RULE} d={`M156 ${43 + i * 15}H280`} strokeWidth="0.6" />
        </g>
      ))}
    </Scene>
  );
}
