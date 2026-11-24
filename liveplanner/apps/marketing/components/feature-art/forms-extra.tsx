// Feature illustrations for Forms beyond the questions (docs/specs/030-forms/forms.md, describe-a-form.md): a form
// drafted from someone's words, the Summary of its responses, and content blocks between the questions. Motion
// reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished frame under
// reduced motion.
import { MUTED, Panel, Pill, RULE, Scene, TEXT, at } from './canvas-parts';

const ACCENT = '#7c3aed';

/** Describe a Form: a sentence in, a preview of the drafted questions with their types, and Create Form. */
export function DescribeFormArt() {
  const questions = [
    ['Name', 'Short Answer'],
    ['Coming?', 'Single Choice'],
    ['Dietary needs', 'Multiple Choice'],
    ['Plus-ones', 'Number'],
  ];
  return (
    <Scene>
      <Panel x={10} y={8} w={118} h={80} />
      <text className={TEXT} x={18} y={21} fontSize="6.4" fontWeight="700">
        Describe a Form
      </text>
      <rect
        x={18}
        y={27}
        width={102}
        height={34}
        rx="4"
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
        strokeWidth="0.6"
      />
      {['An RSVP for the offsite,', 'with dietary needs and', 'plus-ones'].map((line, i) => (
        <text key={line} className={TEXT} x={23} y={36 + i * 8} fontSize="5.6">
          {line}
        </text>
      ))}
      <rect x={18} y={68} width={102} height={13} rx="4" fill={ACCENT} />
      <text x={69} y={76.8} fontSize="6" fontWeight="700" fill="#fff" textAnchor="middle">
        Draft Form
      </text>
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.4)}
        d="M130 48h16"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <g className="fa-a-pop" style={at(0.6)}>
        <Panel x={148} y={8} w={142} h={80} />
        <text className={TEXT} x={156} y={21} fontSize="6.4" fontWeight="700">
          Offsite RSVP
        </text>
        {questions.map(([q, type], i) => (
          <g key={q} className="fa-a-pop" style={at(0.8 + i * 0.15)}>
            <text className={TEXT} x={156} y={35 + i * 11} fontSize="5.8" fontWeight="600">
              {q}
            </text>
            <text className={MUTED} x={282} y={35 + i * 11} fontSize="5.2" textAnchor="end">
              {type}
            </text>
          </g>
        ))}
        <rect x={222} y={74} width={60} height={10} rx="3.5" fill={ACCENT} />
        <text x={252} y={81} fontSize="5.4" fontWeight="700" fill="#fff" textAnchor="middle">
          Create Form
        </text>
      </g>
    </Scene>
  );
}

/** The Summary: the responses summed up question by question, read from the cards they made. */
export function FormSummaryArt() {
  const options = [
    { name: 'Yes', n: 10, w: 120 },
    { name: 'Maybe', n: 3, w: 36 },
    { name: 'No', n: 1, w: 12 },
  ];
  return (
    <Scene>
      <Panel x={14} y={6} w={272} h={84} />
      <text className={TEXT} x={24} y={20} fontSize="7" fontWeight="700">
        14 Responses
      </text>
      <Pill x={218} y={12} w={60} label="Open Offsite" />
      <path className={RULE} d="M22 26h256" strokeWidth="0.6" />
      <text className={TEXT} x={24} y={38} fontSize="6.2" fontWeight="700">
        Coming to the offsite?
      </text>
      <text className={MUTED} x={278} y={38} fontSize="5.4" textAnchor="end">
        14 of 14 answered
      </text>
      {options.map((o, i) => {
        const y = 48 + i * 13;
        return (
          <g key={o.name}>
            <text className={TEXT} x={24} y={y + 4} fontSize="5.8">
              {o.name}
            </text>
            <rect
              x={60}
              y={y}
              width={170}
              height={5}
              rx="2.5"
              className="fill-slate-100 dark:fill-slate-700"
            />
            <rect
              className="fa-a-in"
              style={at(0.4 + i * 0.2)}
              x={60}
              y={y}
              width={o.w}
              height={5}
              rx="2.5"
              fill={ACCENT}
            />
            <text className={MUTED} x={278} y={y + 4.4} fontSize="5.4" textAnchor="end">
              {o.n} · {Math.round((o.n / 14) * 100)}%
            </text>
          </g>
        );
      })}
    </Scene>
  );
}

/** Content blocks: a Tip callout and a picture with its caption, between the questions, asking nothing. */
export function FormBlocksArt() {
  return (
    <Scene>
      <Panel x={60} y={4} w={180} h={88} />
      <text className={TEXT} x={70} y={17} fontSize="7" fontWeight="800">
        Venue booking
      </text>
      <g className="fa-a-pop" style={at(0.4)}>
        <rect
          x={70}
          y={23}
          width={160}
          height={18}
          rx="3"
          className="fill-sky-50 stroke-sky-200 dark:fill-sky-500/15 dark:stroke-sky-500/40"
          strokeWidth="0.6"
        />
        <circle cx={78} cy={32} r="3" className="fill-sky-500" />
        <text className={TEXT} x={85} y={30} fontSize="5.4" fontWeight="700">
          Tip
        </text>
        <text className={MUTED} x={85} y={37.5} fontSize="5">
          Rooms hold 40 seated, 60 standing.
        </text>
      </g>
      <g className="fa-a-pop" style={at(0.7)}>
        <defs>
          <linearGradient id="fa-form-photo" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#bae6fd" />
            <stop offset="1" stopColor="#a7f3d0" />
          </linearGradient>
        </defs>
        <rect x={70} y={45} width={160} height={22} rx="3" fill="url(#fa-form-photo)" />
        <path d="M78 65l14-12 10 8 8-5 18 9z" fill="#0f766e" fillOpacity="0.35" />
        <text className={MUTED} x={70} y={73} fontSize="4.8">
          The main hall, set for a workshop
        </text>
      </g>
      <text className={TEXT} x={70} y={84} fontSize="6" fontWeight="700">
        How many seats?
      </text>
      <rect
        x={150}
        y={78}
        width={80}
        height={9}
        rx="2.5"
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-700"
        strokeWidth="0.6"
      />
    </Scene>
  );
}
