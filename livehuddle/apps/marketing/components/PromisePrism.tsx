'use client';

import {
  lucideEyeOff,
  lucideGift,
  lucideGitFork,
  lucideUsers,
  lucideUserX,
} from '@liveworkspace/icons/lucide';
import {
  BrandMark,
  ChevronRightIcon,
  lucideGlyph,
  REPO_URL,
  type IconProps,
} from '@livediagram/ui';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { PROMISES, type Promise, type PromiseId } from '@/lib/promises';

// The promises (docs/specs/019-marketing/marketing-site.md "Promises"), straight after the template
// gallery: "Built with your values in mind", told through the brand mark. The mark is a prism (drawn
// large, without its inner diagram, and opening and turning on hover as the header's does), so a
// beam of white light runs into it and leaves as five coloured beams, each landing on one promise
// (Completely Free, No Account Needed, Open Source, Private by Design, Real-Time Collaboration). On a
// deep indigo band in either appearance, so the light reads.
//
// When the stage scrolls into view the white beam draws in, the prism glows, the five beams fan out one
// after another and each promise lights as its beam lands; a soft pulse then keeps running along every
// beam. Pointing at (or focusing) a promise brightens its beam and dims the rest. The beams are measured
// from the page (the prism and each card), so they meet the cards at any width; below lg the copy and
// the cards stack and the beams give way to a dot of each promise's light. The static HTML, JS off and
// reduced motion show everything in place (@liveworkspace/marketing-site's css/promises.css).

type Look = { Icon: ComponentType<IconProps>; hue: string };

// Each promise's light: bright enough to read as a value on the indigo band (4.5:1 and up).
const LOOK: Record<PromiseId, Look> = {
  free: { Icon: lucideGlyph(lucideGift, 18), hue: '#34d399' },
  'no-account': { Icon: lucideGlyph(lucideUserX, 18), hue: '#fbbf24' },
  'open-source': { Icon: lucideGlyph(lucideGitFork, 18), hue: '#38bdf8' },
  private: { Icon: lucideGlyph(lucideEyeOff, 18), hue: '#fb7185' },
  live: { Icon: lucideGlyph(lucideUsers, 18), hue: '#a78bfa' },
};

type Point = [number, number];
type Beams = { w: number; h: number; into: [Point, Point]; out: Record<PromiseId, string> };

// Where the white beam starts: in the gap between the copy and the stage (the grid's gap is 56px), so
// it never crosses the copy. And where the coloured beams leave the prism (a fraction of its box).
const BEAM_FROM = -44;
const EXIT = { x: 0.7, y: 0.5 };

function measure(stage: HTMLElement): Beams | null {
  const prism = stage.querySelector<HTMLElement>('[data-prism]');
  if (!prism) return null;
  const o = stage.getBoundingClientRect();
  const p = prism.getBoundingClientRect();
  if (p.width === 0) return null;
  const cy = p.top + p.height / 2 - o.top;
  const exit: Point = [p.left + p.width * EXIT.x - o.left, p.top + p.height * EXIT.y - o.top];
  const out = {} as Record<PromiseId, string>;
  for (const promise of PROMISES) {
    const card = stage.querySelector<HTMLElement>(`[data-promise="${promise.id}"]`);
    if (!card) return null;
    const c = card.getBoundingClientRect();
    const end: Point = [c.left - o.left, c.top + c.height / 2 - o.top];
    const mid = (exit[0] + end[0]) / 2;
    out[promise.id] =
      `M ${exit[0]} ${exit[1]} C ${mid} ${exit[1]}, ${mid} ${end[1]}, ${end[0]} ${end[1]}`;
  }
  const inX = p.left - o.left + p.width * 0.3;
  return {
    w: o.width,
    h: o.height,
    into: [
      [BEAM_FROM, cy],
      [inX, cy],
    ],
    out,
  };
}

// True once the stage has come into view (it then stays lit). The hook arms the stage (`data-armed`)
// once script runs, so the static HTML and a visit without script show everything in place; only an
// armed stage waits, dark, to be seen.
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen || typeof IntersectionObserver === 'undefined') return;
    el.setAttribute('data-armed', '');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

export function PromisePrism() {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [hot, setHot] = useState<PromiseId | null>(null);
  const [beams, setBeams] = useState<Beams | null>(null);
  const [spinning, setSpinning] = useState(false);

  useLayoutEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const update = () => setBeams(measure(stage));
    update();
    void document.fonts?.ready.then(update);
    // Without layout observation (an old browser, a test DOM) the beams are drawn once, as measured.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [ref]);

  return (
    <section
      aria-labelledby="promises-heading"
      className="relative overflow-hidden bg-[#0b1026] text-white"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="text-center lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-300">No catch</p>
          <h2
            id="promises-heading"
            className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            Built with your values in mind
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-slate-300">
            livediagram is free, open and private for everyone, and it stays that way. One light,
            five promises, kept in the open.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold text-[#0b1026] transition-colors hover:bg-sky-100"
            >
              <span className="text-optical-centre">Read the source</span>
              <ChevronRightIcon size={14} aria-hidden />
            </a>
            <a
              href="/telemetry/"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
            >
              <span className="text-optical-centre">See what we measure</span>
              <ChevronRightIcon size={14} aria-hidden />
            </a>
          </div>
        </div>

        <div
          ref={ref}
          data-seen={seen ? '' : undefined}
          className="promise-stage relative"
          onPointerLeave={() => setHot(null)}
        >
          {beams ? (
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden overflow-visible lg:block"
              width={beams.w}
              height={beams.h}
            >
              <defs>
                <linearGradient
                  id="promise-beam-in"
                  gradientUnits="userSpaceOnUse"
                  x1={beams.into[0][0]}
                  x2={beams.into[1][0]}
                  y1="0"
                  y2="0"
                >
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0.95" />
                </linearGradient>
              </defs>
              <path
                className="promise-beam-in"
                d={`M ${beams.into[0][0]} ${beams.into[0][1]} L ${beams.into[1][0]} ${beams.into[1][1]}`}
                pathLength={1}
                stroke="url(#promise-beam-in)"
                strokeWidth={3}
                strokeLinecap="round"
              />
              {PROMISES.map((p, i) => (
                <g
                  key={p.id}
                  className="promise-beam"
                  data-hot={hot === p.id ? '' : undefined}
                  data-dim={hot && hot !== p.id ? '' : undefined}
                  style={{ '--i': i, '--hue': LOOK[p.id].hue } as CSSProperties}
                >
                  <path
                    className="promise-beam-glow"
                    d={beams.out[p.id]}
                    pathLength={1}
                    fill="none"
                    stroke={LOOK[p.id].hue}
                    strokeWidth={9}
                    strokeLinecap="round"
                  />
                  <path
                    className="promise-beam-line"
                    d={beams.out[p.id]}
                    pathLength={1}
                    fill="none"
                    stroke={LOOK[p.id].hue}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <path
                    className="promise-beam-pulse"
                    d={beams.out[p.id]}
                    pathLength={1}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </g>
              ))}
            </svg>
          ) : null}

          {/* The prism, with a glow behind it that swells as the light arrives. Pointing at it opens
              and turns it, as the header's logo does. */}
          <div
            aria-hidden
            onPointerEnter={(e) => e.pointerType !== 'touch' && setSpinning(true)}
            onPointerLeave={() => setSpinning(false)}
            className="absolute left-8 top-1/2 hidden h-36 w-36 -translate-y-1/2 lg:block"
          >
            <div className="promise-prism-glow pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgb(56_189_248/0.45),transparent_65%)]" />
            <div data-prism className="promise-prism relative h-full w-full">
              <BrandMark
                variant="compact"
                spinning={spinning}
                className="h-full w-full drop-shadow-[0_18px_30px_rgb(37_99_235/0.45)]"
              />
            </div>
          </div>

          <ul className="flex flex-col gap-3 lg:ml-[16.5rem]">
            {PROMISES.map((p, i) => (
              <PromiseCard
                key={p.id}
                promise={p}
                index={i}
                hot={hot === p.id}
                onHot={(on) => setHot(on ? p.id : null)}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function PromiseCard({
  promise: p,
  index,
  hot,
  onHot,
}: {
  promise: Promise;
  index: number;
  hot: boolean;
  onHot: (on: boolean) => void;
}) {
  const { Icon, hue } = LOOK[p.id];
  const body = (
    <>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ color: hue, backgroundColor: `color-mix(in srgb, ${hue} 14%, transparent)` }}
      >
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-xl font-semibold tracking-tight" style={{ color: hue }}>
            {p.value}
          </span>
          <span className="font-semibold text-white">{p.title}</span>
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-slate-300">{p.line}</span>
        {p.link ? (
          <span
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold"
            style={{ color: hue }}
          >
            {p.link.label}
            <ChevronRightIcon size={14} aria-hidden />
          </span>
        ) : null}
      </span>
    </>
  );
  const className =
    'promise-card flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-colors duration-micro hover:border-white/25 hover:bg-white/[0.07] sm:p-5';
  const events = {
    onPointerEnter: () => onHot(true),
    onFocus: () => onHot(true),
    onBlur: () => onHot(false),
  };
  return (
    <li
      data-promise={p.id}
      data-hot={hot ? '' : undefined}
      style={{ '--i': index, '--hue': hue } as CSSProperties}
      className="promise-card-slot"
    >
      {p.link ? (
        <a
          href={p.link.href}
          {...(p.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className={`${className} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300`}
          {...events}
        >
          {body}
        </a>
      ) : (
        <div className={className} {...events}>
          {body}
        </div>
      )}
    </li>
  );
}
