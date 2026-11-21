// Trust Built Into Every Page: a page's owner and verified tick, Page Health beside it, a page whose review has
// come due, and the knowledgebase's health as one bar.
import { ArtPanel, Avatar, Bars, Board, Button, Card, Label, T, Tick, at } from './kit';

// Page Health's rows: what it is, then its value.
const HEALTH: readonly [string, string][] = [
  ['Owner', 'Maya Chen'],
  ['Last verified', '3 November'],
  ['Review every', '90 days'],
];

// Knowledge Health: each state's stretch of the bar (where it starts, how wide), its swatch and its count.
const STATES: readonly { label: string; x: number; width: number; fill: string }[] = [
  { label: '42 Verified', x: 354, width: 86, fill: 'fill-emerald-500' },
  { label: '9 Review Due', x: 440, width: 30, fill: 'fill-orange-500' },
  { label: '6 Never Verified', x: 470, width: 20, fill: 'fill-slate-300 dark:fill-slate-600' },
];

export function TrustArt() {
  return (
    <ArtPanel>
      <Board>
        {/* A verified page: who owns it, who vouched for it, and when it is next due. */}
        <Card x={14} y={20} w={304} h={186}>
          <T x={34} y={56} size={20} weight={700}>
            Refund Policy
          </T>
          <Avatar cx={45} cy={82} fill="fill-violet-500" initial="M" />
          <T x={63} y={86} size={12} weight={600}>
            Maya Chen
            <tspan
              dx={6}
              fontSize={11.5}
              fontWeight={400}
              className="fill-slate-500 dark:fill-slate-400"
            >
              owns this page
            </tspan>
          </T>
          <rect
            x={34}
            y={104}
            width={150}
            height={26}
            rx={13}
            className="fill-emerald-100 dark:fill-emerald-900"
          />
          <Tick cx={48} cy={117} r={8} />
          <T
            x={62}
            y={121}
            size={11.5}
            weight={600}
            className="fill-emerald-800 dark:fill-emerald-100"
          >
            Verified by Maya
          </T>
          <T x={196} y={121} size={11.5} tone="quiet">
            Review due 1 Feb
          </T>
          <Bars x={34} y={150} widths={[262, 244, 150]} />
        </Card>

        {/* Page Health. */}
        <Card x={338} y={20} w={168} h={186}>
          <Label x={354} y={46}>
            PAGE HEALTH
          </Label>
          {HEALTH.map(([name, value], i) => (
            <g key={name} className="kb-in" style={at(0.5 + i * 0.2)}>
              <T x={354} y={68 + i * 34} size={10.5} tone="quiet">
                {name}
              </T>
              <T x={354} y={83 + i * 34} size={12.5} weight={600}>
                {value}
              </T>
            </g>
          ))}
          <Button x={354} y={166} w={136} filled>
            Verify Again
          </Button>
        </Card>

        {/* A page that has come due, in its owner's list. */}
        <Card x={14} y={228} w={304} h={126}>
          <Label x={34} y={254}>
            YOURS TO REVIEW
          </Label>
          <T x={34} y={282} size={15} weight={700}>
            Pricing FAQ
          </T>
          <rect
            x={34}
            y={294}
            width={100}
            height={22}
            rx={11}
            className="fill-orange-100 dark:fill-orange-900"
          />
          <circle cx={47} cy={305} r={3.5} className="fa-pulse fill-orange-500" />
          <T x={57} y={309} size={11} weight={600} className="fill-orange-800 dark:fill-orange-100">
            Review Due
          </T>
          <T x={34} y={341} size={10.5} tone="quiet">
            Due 12 days ago
          </T>
          <Button x={206} y={266} w={96} filled>
            Still Right
          </Button>
          <Button x={206} y={302} w={96}>
            Open Page
          </Button>
        </Card>

        {/* The whole knowledgebase, as one stacked bar. */}
        <Card x={338} y={228} w={168} h={126}>
          <Label x={354} y={254}>
            KNOWLEDGE HEALTH
          </Label>
          {STATES.map((state, i) => (
            <g key={state.label} className="kb-in" style={at(0.8 + i * 0.25)}>
              <rect
                x={state.x}
                y={266}
                width={state.width - 2}
                height={12}
                rx={3}
                className={state.fill}
              />
              <rect x={354} y={291 + i * 18} width={8} height={8} rx={2} className={state.fill} />
              <T x={368} y={299 + i * 18} size={10.5}>
                {state.label}
              </T>
            </g>
          ))}
        </Card>
      </Board>
    </ArtPanel>
  );
}
