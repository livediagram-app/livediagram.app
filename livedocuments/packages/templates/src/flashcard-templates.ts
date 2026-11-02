// The flashcard templates (docs/specs/007-editor/flashcards.md "Making flashcards"): stacks written out, so the cards
// show what they are for. Each card is a flashcard page with its own writing (a title, then a short paragraph or two or
// a short list), small enough to fit a 900 x 540 card with Narrow margins. Pure data, merged in by
// templateCanvasOverrides.
import {
  newFlashcardPage,
  type ArticleBlock,
  type ArticleFlow,
  type Page,
  type Tab,
} from '@livedocuments/document';

// A card as written: its title and its body, each body entry a paragraph or a list of bullets.
type CardText = { title: string; body: readonly (string | readonly string[])[] };

export type FlashcardTemplateKind =
  'talk-flashcards' | 'wedding-toast' | 'pitch-flashcards' | 'class-presentation';

const CARDS: Readonly<Record<FlashcardTemplateKind, readonly CardText[]>> = {
  'talk-flashcards': [
    {
      title: 'Opening',
      body: [
        'Thank the hosts. Smile, pause, and let the room settle before the first line.',
        'Ask: "Who here has shipped something nobody used?" Wait for the hands. Mine is up too.',
      ],
    },
    {
      title: 'The Problem',
      body: [
        'We spent a year building a feature our customers asked for, and almost nobody turned it on.',
        [
          'They asked for the answer they could picture',
          'We never asked what they were trying to do',
          'The numbers looked fine until launch day',
        ],
      ],
    },
    {
      title: 'What We Tried',
      body: [
        'First we added a tour. Then a banner. Then an email. Each one moved the numbers a little, then they fell back.',
        'Slow down here: the lesson is that none of it touched the real reason.',
      ],
    },
    {
      title: 'What Worked',
      body: [
        'We sat beside five customers for an afternoon each and watched them work, saying nothing.',
        'In a week we cut the feature in half, moved it to where they already were, and use doubled.',
      ],
    },
    {
      title: 'What It Means for You',
      body: [
        [
          'Watch before you build: an afternoon beats a survey',
          'Put new things where people already look',
          'Measure what people do, not what they say',
        ],
      ],
    },
    {
      title: 'Close and Questions',
      body: [
        'Go back to the hands from the start: next time, they can stay down.',
        'Thank everyone, then: "I would love your questions." Repeat each question before answering it.',
      ],
    },
  ],
  'wedding-toast': [
    {
      title: 'Hello',
      body: [
        'Good evening, everyone. For those I have not met, I am Sam, and I have known Alex since we were seven.',
        'I promised the couple I would keep this short. I promised Alex I would keep it clean. One of those is true.',
      ],
    },
    {
      title: 'Alex, Back Then',
      body: [
        'Alex was the kid who built a raft out of milk crates and was certain it would float.',
        'It did not. Alex was not discouraged. That, I have learned, is the whole of Alex.',
      ],
    },
    {
      title: 'Meeting Jordan',
      body: [
        'The first time Alex talked about Jordan, it was for forty minutes without stopping. I timed it.',
        'Then I met Jordan, and I understood. Kind, quick, and the only person who has ever beaten Alex at cards.',
      ],
    },
    {
      title: 'What I Wish You',
      body: [
        [
          'Patience on the slow days',
          'Laughter on the long ones',
          'And a raft that floats this time',
        ],
      ],
    },
    {
      title: 'The Toast',
      body: [
        'Would you all please raise your glasses.',
        'To Alex and Jordan: may every year be better than the last, and every argument end in laughter. Cheers!',
      ],
    },
  ],
  'pitch-flashcards': [
    {
      title: 'The Hook',
      body: [
        'Every week, a small café throws away about a fifth of the food it makes.',
        'That is money in the bin, and nobody has a simple way to stop it.',
      ],
    },
    {
      title: 'The Problem',
      body: [
        'Owners guess how much to bake each morning. Guess high and food is wasted; guess low and customers leave.',
        'The tools that predict demand are built for supermarkets, not a shop with one till.',
      ],
    },
    {
      title: 'Our Answer',
      body: [
        'Morning Count reads the till, the weather and the local calendar, and tells you each dawn how much to make.',
        'One number per item, on the phone already in your pocket.',
      ],
    },
    {
      title: 'Proof So Far',
      body: [
        [
          '40 cafés in the pilot, 36 still using it',
          'Waste down by a third on average',
          'Paid for itself in under six weeks',
        ],
      ],
    },
    {
      title: 'The Ask',
      body: [
        'We are raising to reach 500 cafés by next summer.',
        'Pause. Then: "Who here has a favourite café? Let us save them some bread." Thank them and stop.',
      ],
    },
  ],
  'class-presentation': [
    {
      title: 'Where Was This Rain?',
      body: [
        'Hold up a glass of water. Ask the class: "Where was this water a week ago? A year ago?"',
        'Say: the same water has been going round for millions of years. Today I will show you how.',
      ],
    },
    {
      title: '1. Evaporation',
      body: [
        'The sun warms seas, lakes and puddles, and some of the water turns into an invisible gas: water vapour.',
        'Point to the kettle photo on the poster: steam is the same thing, only faster.',
      ],
    },
    {
      title: '2. Condensation',
      body: [
        'High up, the air is cold. The vapour cools and turns back into tiny drops, which gather as clouds.',
        'Example: a cold drink "sweats" on a hot day. That is condensation too.',
      ],
    },
    {
      title: '3. Rain and Back Again',
      body: [
        'When the drops grow too heavy, they fall as rain, snow or hail. This is precipitation.',
        [
          'It runs into rivers and the sea',
          'It soaks into the ground',
          'Then the sun warms it, and it all starts again',
        ],
      ],
    },
    {
      title: 'What to Remember',
      body: [
        'Evaporation, condensation, precipitation, collection: four stages, one circle.',
        'Hold up the glass again: "Next time it rains, you might be drinking dinosaur water." Thank the class and ask for questions.',
      ],
    },
  ],
};

// A card's writing as blocks, ids unique within the card.
function cardBlocks(kind: FlashcardTemplateKind, index: number, card: CardText): ArticleBlock[] {
  let n = 0;
  const id = () => `b-${kind}-${index + 1}-${++n}`;
  const blocks: ArticleBlock[] = [
    { id: id(), type: 'paragraph', style: 'title', runs: [{ text: card.title }] },
  ];
  for (const part of card.body) {
    if (typeof part === 'string')
      blocks.push({ id: id(), type: 'paragraph', runs: [{ text: part }] });
    else
      for (const item of part)
        blocks.push({ id: id(), type: 'list', list: 'bullet', runs: [{ text: item }] });
  }
  return blocks;
}

/** A flashcard template's cards: its pages and their writing. */
export function flashcardTemplateOverrides(kind: FlashcardTemplateKind): Partial<Tab> {
  const pages: Page[] = [];
  const articles: Record<string, ArticleFlow> = {};
  CARDS[kind].forEach((card, i) => {
    const flow = `card-${i + 1}`;
    pages.push(newFlashcardPage(`page-${i + 1}`, flow));
    articles[flow] = { blocks: cardBlocks(kind, i, card), style: { margins: 'narrow' } };
  });
  return { pages, articles };
}

/** Whether a template is one of the flashcard stacks written out. */
export function isFlashcardTemplate(kind: string): kind is FlashcardTemplateKind {
  return Object.hasOwn(CARDS, kind);
}
