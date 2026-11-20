// Ask, With Sources: a question, the answer with a citation on each claim, the passages it came from and who
// verified them, and the part the pages do not cover, said plainly.
import { ArtPanel, Board, Button, Card, Label, Rule, T, Tick } from './kit';

const CITE = 'fill-brand-700 dark:fill-brand-300';

// The Sources rail: each cited passage's number, page and verifier.
const SOURCES: readonly { n: number; page: string; by: string }[] = [
  { n: 1, page: 'Refund Policy', by: 'Verified by Maya' },
  { n: 2, page: 'Returns Guide', by: 'Verified by Sam' },
];

function Cite({ n }: { n: number }) {
  return (
    <tspan dx={4} fontWeight={700} className={CITE}>
      [{n}]
    </tspan>
  );
}

export function AskArt() {
  return (
    <ArtPanel>
      <Board>
        {/* The question, in the asker's own words. */}
        <rect x={205} y={25} width={306} height={44} rx={14} className="fill-brand-400" />
        <rect x={200} y={20} width={306} height={44} rx={14} className="fill-brand-700" />
        <T x={220} y={47} size={14} weight={600} className="fill-white">
          What is our refund window?
        </T>

        {/* The answer: every claim carries the number of its source. */}
        <Card x={14} y={86} w={322} h={178}>
          <Label x={34} y={112}>
            ANSWER
          </Label>
          <T x={34} y={136} size={13.5} weight={500}>
            Refunds are open for 30 days
            <Cite n={1} />
          </T>
          <T x={34} y={157} size={13.5} weight={500}>
            from delivery. Opened items
          </T>
          <T x={34} y={178} size={13.5} weight={500}>
            have 14 days.
            <Cite n={2} />
          </T>
          <Rule x={34} y={200} w={282} />
          <Tick cx={44} cy={232} r={9} />
          <T x={62} y={236} size={12} weight={600}>
            Answered From 2 Verified Pages
          </T>
        </Card>

        {/* Sources: the passages, their pages and who vouches for each. */}
        <Card x={354} y={86} w={152} h={178}>
          <Label x={370} y={112}>
            SOURCES
          </Label>
          {SOURCES.map((source, i) => {
            const y = 124 + i * 66;
            return (
              <g key={source.n}>
                {i > 0 ? <Rule x={370} y={y - 6} w={120} /> : null}
                <T x={370} y={y + 17} size={11.5} weight={700} className={CITE}>
                  [{source.n}]
                </T>
                <T x={392} y={y + 17} size={12} weight={600}>
                  {source.page}
                </T>
                <Tick cx={376} cy={y + 36} r={6} />
                <T x={392} y={y + 40} size={10.5} tone="quiet">
                  {source.by}
                </T>
              </g>
            );
          })}
        </Card>

        {/* What the pages do not cover: said, never guessed, and turned into a page to write. */}
        <Card x={14} y={286} w={492} h={70}>
          <circle
            cx={46}
            cy={321}
            r={14}
            strokeWidth={1.75}
            strokeDasharray="3 3.5"
            className="fa-pulse fill-none stroke-slate-500 dark:stroke-slate-400"
          />
          <T x={46} y={326} size={15} weight={700} anchor="middle" tone="quiet">
            ?
          </T>
          <Label x={72} y={312}>
            KNOWLEDGE GAP
          </Label>
          <T x={72} y={333} size={12.5} weight={600}>
            The pages do not cover gift card refunds.
          </T>
          <Button x={386} y={307} w={104}>
            Draft a Page
          </Button>
        </Card>
      </Board>
    </ArtPanel>
  );
}
