// Feature illustrations for the structural elements added in spec/118-121:
// the mind node, the lane, the entity box, and canvas embeds. Split into their
// own file rather than growing content.tsx, which is already the richer-content
// scenes; see ./shared for Frame + colour constants.
import { Frame } from './shared';

// Mind map: a root with three branches, drawn as the keyboard would build it
// — parent on the left, children stacked to the right on their connectors.
export function MindMapArt() {
  const branches = ['Discovery', 'Design', 'Build'];
  return (
    <Frame canvas>
      <div className="flex h-full items-center gap-3 px-4">
        <span className="relative rounded-[5px] border border-brand-300 bg-brand-50 px-2 py-1.5 text-[7px] font-semibold text-brand-700">
          Roadmap
        </span>
        <svg className="h-14 w-5 shrink-0 text-slate-400" viewBox="0 0 20 56" aria-hidden>
          <path
            d="M0 28h7M7 28V9h13M7 28h13M7 28v19h13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
        <div className="flex flex-col gap-1.5">
          {branches.map((b, i) => (
            <span
              key={b}
              className="relative rounded-[5px] border border-slate-300 bg-white px-2 py-1 text-[7px] font-medium text-slate-600"
            >
              {b}
              {/* The last one blinks as if just grown by a keystroke. */}
              {i === branches.length - 1 ? (
                <span className="fa-hl pointer-events-none absolute inset-0 rounded-[5px] ring-2 ring-brand-500" />
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// Swimlanes: three titled bands with steps sitting inside them.
export function LanesArt() {
  const lanes = [
    { role: 'Design', steps: 2 },
    { role: 'Build', steps: 3 },
    { role: 'QA', steps: 1 },
  ];
  return (
    <Frame canvas>
      <div className="flex h-full flex-col justify-center gap-1 px-3">
        {lanes.map((lane) => (
          <div
            key={lane.role}
            className="flex items-center overflow-hidden rounded-[3px] border border-slate-300 bg-white"
          >
            <span className="w-[46px] shrink-0 border-r border-slate-300 bg-slate-100 px-1.5 py-1.5 text-[6px] font-semibold text-slate-600">
              {lane.role}
            </span>
            <span className="flex flex-1 items-center gap-1.5 px-2">
              {Array.from({ length: lane.steps }).map((_, i) => (
                <span
                  key={i}
                  className="h-3 w-7 rounded-[2px] border border-brand-300 bg-brand-50"
                />
              ))}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// Entity box: a title bar over name / type rows, joined to a second one.
export function EntityArt() {
  const fields = [
    ['id', 'uuid'],
    ['email', 'string'],
    ['team', 'Team'],
  ];
  return (
    <Frame canvas>
      <div className="flex h-full items-center justify-center gap-2 px-3">
        <div className="overflow-hidden rounded-[3px] border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-[7px] font-semibold text-slate-700">
            User
          </div>
          {fields.map(([name, type]) => (
            <div key={name} className="flex w-[86px] justify-between px-2 py-[3px]">
              <span className="text-[6px] text-slate-600">{name}</span>
              <span className="text-[6px] text-slate-400">{type}</span>
            </div>
          ))}
        </div>
        <svg className="h-3 w-6 shrink-0 text-slate-400" viewBox="0 0 24 12" aria-hidden>
          <path d="M0 6h18" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <path d="M18 2.5 23 6l-5 3.5z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <div className="overflow-hidden rounded-[3px] border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-[7px] font-semibold text-slate-700">
            Team
          </div>
          <div className="w-[72px] px-2 py-[3px] text-[6px] text-slate-600">id</div>
          <div className="w-[72px] px-2 py-[3px] text-[6px] text-slate-600">name</div>
        </div>
      </div>
    </Frame>
  );
}

// A video embed sitting on the canvas, poster and play button, unplayed —
// which is the point: nothing loads until somebody asks.
export function EmbedArt() {
  return (
    <Frame canvas>
      <div className="flex h-full items-center justify-center px-4">
        <div className="relative h-[62px] w-[110px] overflow-hidden rounded-[4px] border border-slate-300 bg-slate-900 shadow-sm">
          {/* A suggestion of a poster frame behind the button. */}
          <span className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />
          <span className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10" />
          <span className="absolute left-1/2 top-1/2 flex h-5 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[4px] bg-[#ff0000]">
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
              <path d="M4 2.5 9 6l-5 3.5z" fill="#fff" />
            </svg>
          </span>
          <span className="fa-hl pointer-events-none absolute inset-0 rounded-[4px] ring-2 ring-brand-400" />
        </div>
      </div>
    </Frame>
  );
}
