// The style guide (docs/specs/011-theme/style-guide.md): when to use each part of a tab's style (theme, page design,
// typeface, finish) and whole looks that go together by occasion, so an agent dresses a document for its content and
// tone as a person would in Tab Style. Pure data; the catalogues it describes stay the source of their ids, and the
// tests hold it to them (every id described, none unknown).
import type { PageDesignId } from './page-designs/catalogue';
import type { Finish } from '@liveworkspace/element-model/finish';

/** How formal a choice reads, from a board pack (formal) to a party invite (playful). */
export type StyleTone = 'formal' | 'neutral' | 'friendly' | 'playful' | 'bold';

export type StyleNote = { tone: readonly StyleTone[]; use: string };

const n = (tone: StyleTone | readonly StyleTone[], use: string): StyleNote => ({
  tone: typeof tone === 'string' ? [tone] : tone,
  use,
});

/** Each theme: when its colours suit the content. */
export const THEME_GUIDE: Readonly<Record<string, StyleNote>> = {
  brand: n(
    ['formal', 'neutral'],
    'Any document that should look like the product itself: the clean default blue.',
  ),
  mono: n('formal', 'Minimal, serious or print-first documents: black, white and grey.'),
  steel: n('formal', 'Engineering, operations and industrial reports: cool steel greys.'),
  indigo: n(['formal', 'neutral'], 'Strategy decks, consulting and legal: deep, confident blue.'),
  ocean: n('neutral', 'General business, health and travel: fresh blues and teals.'),
  sky: n(['neutral', 'friendly'], 'Product updates, onboarding and SaaS: light, airy blue.'),
  teal: n('neutral', 'Healthcare, science and wellbeing: clean teal.'),
  slate: n(['friendly', 'neutral'], 'Marketing and brand pieces that want warmth: soft pink.'),
  forest: n('neutral', 'Sustainability, environment and outdoors: natural greens.'),
  pine: n(['neutral', 'formal'], 'Nature, heritage and long-form reports: deep green.'),
  olive: n('neutral', 'Food, agriculture and craft: muted olive.'),
  evergreen: n('neutral', 'Annual reviews and evergreen guides: rich green.'),
  sand: n(['neutral', 'friendly'], 'Hospitality, lifestyle and travel: warm sand.'),
  cream: n(['neutral', 'friendly'], 'Editorial, essays and menus: soft paper cream.'),
  mocha: n('neutral', 'Coffee, food and cosy editorial: warm browns.'),
  espresso: n(['bold', 'formal'], 'Premium and luxury pieces: dark roast browns.'),
  sunset: n(['friendly', 'bold'], 'Launches, events and creative pitches: warm orange to pink.'),
  rose: n('friendly', 'Weddings, beauty and personal pieces: rose.'),
  lavender: n('friendly', 'Wellbeing, education and gentle guides: lavender.'),
  plum: n(['bold', 'neutral'], 'Fashion, arts and premium brands: rich plum.'),
  midnight: n('bold', 'Keynotes and tech talks on dark slides: deep night blue.'),
  abyss: n('bold', 'Dramatic dark decks, gaming and film: near-black depths.'),
  rainbow: n('playful', 'Kids, inclusion and celebration: every colour.'),
  pastel: n('playful', 'Classrooms, baby and soft playful pieces: pastels.'),
  tropical: n('playful', 'Summer, travel and parties: bright tropical colours.'),
  sparkle: n('playful', 'Celebrations, announcements and New Year: festive sparkle.'),
  spring: n('friendly', 'Spring campaigns, gardening and fresh starts: blossoms and greens.'),
  pumpkin: n('playful', 'Autumn and Halloween: pumpkin orange.'),
  yuletide: n('playful', 'Christmas and winter holidays: festive red and green.'),
  frost: n(['friendly', 'neutral'], 'Winter campaigns and cool calm pieces: icy blues.'),
};

/** Each page design: when its art suits the pages. Quieter designs suit formal and text-heavy pages. */
export const DESIGN_GUIDE: Readonly<Record<PageDesignId, StyleNote>> = {
  'soft-mesh': n(
    ['neutral', 'friendly'],
    'Modern product, startup and SaaS decks: soft colour behind words.',
  ),
  aurora: n('bold', 'Keynotes, vision and future talks: glowing colour, best on title slides.'),
  'duotone-sweep': n('neutral', 'Clean marketing and brand decks: a two-colour sweep.'),
  'radial-glow': n(
    ['neutral', 'bold'],
    'Title and section slides that want focus: a glow behind the centre.',
  ),
  'sunset-bands': n(['friendly', 'bold'], 'Events, travel and creative pitches: warm bands.'),
  grid: n(['formal', 'neutral'], 'Plans, specs and technical reports: a faint grid.'),
  dots: n(['neutral', 'friendly'], 'Workshops, notes and planning: a light dot grid.'),
  isometric: n('neutral', 'Architecture, 3D and product design: an isometric grid.'),
  hexagons: n(['neutral', 'bold'], 'Science, chemistry and tech: hexagons.'),
  triangles: n(['bold', 'friendly'], 'Energetic marketing and sport: angular triangles.'),
  'concentric-rings': n(['neutral', 'bold'], 'Focus, targets and radio or audio themes: rings.'),
  'diagonal-stripes': n(['bold', 'playful'], 'Sales, promotions and sport: bold stripes.'),
  moire: n(['bold', 'neutral'], 'Science, sound and optical themes: shimmering moiré rings.'),
  blobs: n(['friendly', 'playful'], 'Friendly onboarding, education and wellbeing: soft blobs.'),
  'blob-echo': n(
    ['playful', 'friendly'],
    'Youth, clubs and playful welcomes: blobs ringed by echoes.',
  ),
  'lava-lamp': n(
    ['playful', 'bold'],
    'Lounges, music nights and retro fun: gooey lava lamp blobs.',
  ),
  waves: n(['friendly', 'neutral'], 'Ocean, travel, health and calm pieces: flowing waves.'),
  topographic: n('neutral', 'Outdoors, geography and strategy maps: contour lines.'),
  ribbons: n(['friendly', 'bold'], 'Brand stories and creative decks: flowing ribbons.'),
  marbled: n(['bold', 'neutral'], 'Luxury, arts and editorial: marbled paper.'),
  'paper-grain': n(['formal', 'neutral'], 'Essays, reports and editorial: a quiet paper texture.'),
  noise: n(['neutral', 'formal'], 'Subtle depth behind any content: fine grain.'),
  linen: n(['formal', 'neutral'], 'Invitations, menus and classic documents: woven linen.'),
  risograph: n(['playful', 'bold'], 'Zines, posters and indie creative work: risograph print.'),
  'riso-overprint': n(
    ['bold', 'playful'],
    'Art studios and print fairs: flat riso inks overprinted.',
  ),
  'riso-fade': n(
    ['bold', 'playful'],
    'Album, band and creative covers: two riso dot screens fading across.',
  ),
  'riso-lines': n(
    ['playful', 'friendly'],
    'Bookshops, presses and illustration: riso line screens.',
  ),
  halftone: n(['bold', 'playful'], 'Pop, comics and retro marketing: halftone dots.'),
  blueprint: n('neutral', 'Engineering, architecture and plans: blueprint lines.'),
  terrazzo: n(['friendly', 'neutral'], 'Interiors, cafes and property: terrazzo stone chips.'),
  'glass-panels': n(['neutral', 'bold'], 'Modern tech and product decks: frosted glass.'),
  spotlight: n('bold', 'Reveals, awards and hero slides: a spotlight.'),
  bokeh: n(['friendly', 'bold'], 'Celebrations, evenings and photography: soft bokeh lights.'),
  'soft-shadows': n(['formal', 'neutral'], 'Calm professional pages: soft shadow shapes.'),
  'layered-cards': n('neutral', 'Product features and portfolios: layered cards.'),
  'card-cascade': n(
    ['neutral', 'friendly'],
    'Steps, options and pricing tiers: a cascade of cards.',
  ),
  polaroids: n(['friendly', 'playful'], 'Trips, memories and moodboards: pinned instant photos.'),
  'corner-accents': n(
    ['formal', 'neutral'],
    'Formal decks and reports: small accents in the corners, plenty of room.',
  ),
  'edge-bands': n(['formal', 'neutral'], 'Business reports and handouts: a band along the edge.'),
  'side-rail': n(['formal', 'neutral'], 'Long reports and training decks: a rail down the side.'),
  'torn-paper': n(['playful', 'friendly'], 'Scrapbooks, classrooms and crafts: torn paper edges.'),
  'offset-border': n(['neutral', 'friendly'], 'Posters, menus and portfolios: an offset frame.'),
  'brutalist-blocks': n('bold', 'Design studios and statement decks: heavy blocks.'),
  memphis: n('playful', 'Parties, kids and retro fun: Memphis shapes.'),
  'swiss-grid': n(['bold', 'formal'], 'Design-led reports and editorial: Swiss grid blocks.'),
  'split-fields': n(['bold', 'neutral'], 'Comparisons and two-part stories: split colour fields.'),
  'type-watermark': n(['bold', 'neutral'], 'Section and title slides: a large letter watermark.'),
  bauhaus: n(['bold', 'neutral'], 'Design, architecture and modernist posters: Bauhaus tiles.'),
  'brush-strokes': n(
    ['bold', 'friendly'],
    'Art, charity and handmade work: painterly brush strokes.',
  ),
  sunburst: n(['bold', 'playful'], 'Celebrations, summer and vintage announcements: a sunburst.'),
  circuit: n('bold', 'Hardware, engineering and AI talks: circuit traces.'),
  starfield: n('bold', 'Space, vision and night themes: a starfield.'),
  constellations: n(['bold', 'friendly'], 'Networks, connections and inspiration: constellations.'),
  'data-grid': n(['neutral', 'bold'], 'Data, analytics and dashboards: a data grid.'),
  scanlines: n(['bold', 'playful'], 'Gaming, retro tech and broadcast: scanlines.'),
};

/** Each typeface (FONTS' ids): when its letters suit the words. */
export const FONT_GUIDE: Readonly<Record<string, StyleNote>> = {
  inter: n(
    ['formal', 'neutral'],
    'Business, reports and UI: clear, neutral sans, the safe default.',
  ),
  poppins: n(['friendly', 'neutral'], 'Marketing, startups and education: geometric and friendly.'),
  nunito: n(['friendly', 'playful'], 'Kids, wellbeing and gentle guides: rounded and soft.'),
  oswald: n('bold', 'Headlines, sport and posters: tall condensed capitals.'),
  'space-grotesk': n(['neutral', 'bold'], 'Tech, product and design decks: a modern techy sans.'),
  lora: n(['formal', 'neutral'], 'Essays, reports, legal and long reading: a warm serif.'),
  'abril-fatface': n(
    ['bold', 'formal'],
    'Editorial, fashion and luxury titles: a high-contrast display serif.',
  ),
  'roboto-slab': n('neutral', 'Education, guides and handouts: a sturdy slab serif.'),
  'roboto-mono': n('neutral', 'Engineering, code and data: monospace.'),
  caveat: n(['friendly', 'playful'], 'Workshops, notes and personal pieces: handwriting.'),
  'permanent-marker': n('playful', 'Brainstorms, posters and fun: a felt-tip marker.'),
};

/** Each finish: how shapes and lines are drawn, and when that suits. */
export const FINISH_GUIDE: Readonly<Record<Finish, StyleNote>> = {
  professional: n(
    'formal',
    'Formal decks, reports, finance, legal and anything for clients: square, fine lines.',
  ),
  flexible: n(
    ['neutral', 'friendly'],
    'Most documents: soft rounded corners, the everyday default.',
  ),
  sketch: n(['friendly', 'playful'], 'Workshops, brainstorms, drafts and teaching: drawn by hand.'),
  marker: n(
    ['playful', 'bold'],
    'Posters, kids, retros and fun pieces: bold felt-tip with coloured-in fills.',
  ),
};

/** A whole look by occasion: what goes together, theme first, so an agent can dress a document in one choice. */
export type StyleRecipe = {
  id: string;
  occasion: string;
  // Words that point to it, for "auto".
  keywords: readonly string[];
  theme: string;
  design: PageDesignId | 'none';
  font: string;
  finish: Finish;
};

export const STYLE_RECIPES: readonly StyleRecipe[] = [
  {
    id: 'formal-report',
    occasion: 'Formal decks and reports: board, finance, legal, compliance, client proposals',
    keywords: [
      'board',
      'finance',
      'financial',
      'quarterly',
      'annual',
      'report',
      'legal',
      'compliance',
      'policy',
      'audit',
      'proposal',
      'client',
      'investor',
      'budget',
      'governance',
      'formal',
    ],
    theme: 'mono',
    design: 'corner-accents',
    font: 'inter',
    finish: 'professional',
  },
  {
    id: 'strategy',
    occasion: 'Strategy and consulting: plans, reviews, roadmaps for leadership',
    keywords: [
      'strategy',
      'roadmap',
      'plan',
      'okr',
      'review',
      'leadership',
      'consulting',
      'priorities',
      'quarter',
      'executive',
    ],
    theme: 'indigo',
    design: 'side-rail',
    font: 'inter',
    finish: 'professional',
  },
  {
    id: 'editorial',
    occasion: 'Long reading: essays, articles, research, white papers',
    keywords: [
      'essay',
      'article',
      'research',
      'paper',
      'whitepaper',
      'study',
      'story',
      'history',
      'thesis',
      'newsletter',
      'guide',
    ],
    theme: 'cream',
    design: 'paper-grain',
    font: 'lora',
    finish: 'professional',
  },
  {
    id: 'product-pitch',
    occasion: 'Startup and product: pitch decks, launches, product updates',
    keywords: [
      'startup',
      'pitch',
      'launch',
      'product',
      'feature',
      'release',
      'saas',
      'app',
      'growth',
      'demo',
      'update',
    ],
    theme: 'sky',
    design: 'soft-mesh',
    font: 'poppins',
    finish: 'flexible',
  },
  {
    id: 'keynote',
    occasion: 'Keynotes and big talks: vision, conference, all-hands',
    keywords: [
      'keynote',
      'vision',
      'conference',
      'talk',
      'future',
      'allhands',
      'summit',
      'inspire',
      'mission',
    ],
    theme: 'midnight',
    design: 'aurora',
    font: 'space-grotesk',
    finish: 'flexible',
  },
  {
    id: 'technical',
    occasion: 'Technical: engineering, architecture, data, AI',
    keywords: [
      'engineering',
      'architecture',
      'api',
      'system',
      'data',
      'ai',
      'technical',
      'code',
      'infrastructure',
      'security',
      'analytics',
      'migration',
    ],
    theme: 'steel',
    design: 'grid',
    font: 'space-grotesk',
    finish: 'professional',
  },
  {
    id: 'teaching',
    occasion: 'Teaching and training: lessons, courses, onboarding, how-tos',
    keywords: [
      'lesson',
      'course',
      'training',
      'onboarding',
      'tutorial',
      'learn',
      'class',
      'school',
      'students',
      'teacher',
      'howto',
      'workshop',
    ],
    theme: 'ocean',
    design: 'blobs',
    font: 'nunito',
    finish: 'flexible',
  },
  {
    id: 'workshop',
    occasion: 'Workshops, brainstorms, retros and drafts',
    keywords: [
      'brainstorm',
      'retro',
      'retrospective',
      'ideas',
      'draft',
      'sketch',
      'jam',
      'kickoff',
      'sprint',
      'notes',
    ],
    theme: 'sand',
    design: 'dots',
    font: 'caveat',
    finish: 'sketch',
  },
  {
    id: 'celebration',
    occasion: 'Celebrations and events: parties, invitations, awards',
    keywords: [
      'party',
      'birthday',
      'invitation',
      'invite',
      'celebration',
      'wedding',
      'awards',
      'event',
      'festival',
      'gala',
    ],
    theme: 'sparkle',
    design: 'bokeh',
    font: 'abril-fatface',
    finish: 'flexible',
  },
  {
    id: 'playful',
    occasion: 'Kids, clubs and fun: games, quizzes, posters',
    keywords: [
      'kids',
      'children',
      'fun',
      'game',
      'quiz',
      'poster',
      'club',
      'summer',
      'play',
      'camp',
    ],
    theme: 'rainbow',
    design: 'memphis',
    font: 'permanent-marker',
    finish: 'marker',
  },
  {
    id: 'nature',
    occasion: 'Sustainability, wellbeing and the outdoors',
    keywords: [
      'sustainability',
      'climate',
      'environment',
      'nature',
      'garden',
      'wellbeing',
      'health',
      'outdoors',
      'green',
      'esg',
    ],
    theme: 'forest',
    design: 'topographic',
    font: 'poppins',
    finish: 'flexible',
  },
  {
    id: 'premium',
    occasion: 'Premium, luxury and creative showcases: portfolios, fashion, brand books',
    keywords: [
      'luxury',
      'premium',
      'fashion',
      'portfolio',
      'brand',
      'showcase',
      'gallery',
      'design',
      'collection',
      'art',
    ],
    theme: 'espresso',
    design: 'marbled',
    font: 'abril-fatface',
    finish: 'professional',
  },
];

/** The recipe that best suits the words (most keyword hits; ties to the list's order); none when nothing matches. */
export function pickStyleRecipe(words: string): StyleRecipe | undefined {
  const have = new Set(
    words
      .toLowerCase()
      .replace(/[-_]/g, '')
      .match(/[a-z]+/g) ?? [],
  );
  let best: StyleRecipe | undefined;
  let most = 0;
  for (const r of STYLE_RECIPES) {
    const hits = r.keywords.reduce((sum, k) => sum + (have.has(k) ? 1 : 0), 0);
    if (hits > most) {
      most = hits;
      best = r;
    }
  }
  return best;
}

/** The guide as Markdown, for an agent (the MCP's style guide). Labels come from the catalogues passed in. */
export function styleGuideMarkdown(labels: {
  theme: (id: string) => string;
  design: (id: PageDesignId) => string;
  font: (id: string) => string;
}): string {
  const line = (id: string, label: string, note: StyleNote) =>
    `- \`${id}\` (${label}; ${note.tone.join(', ')}): ${note.use}`;
  return [
    '# livedocuments style guide',
    '',
    'Dress a tab for its content and tone, as a person does in Tab Style. Pick a recipe that fits the occasion, or',
    'build one from the lists: keep the tones together (formal with formal), prefer a quiet design and Professional',
    'finish for formal or text-heavy work, and save bold designs for title and section pages. Every part is the',
    'tab’s and reaches every page; a page may wear its own design. Designs draw in the theme’s colours, behind',
    'everything, and keep text readable.',
    '',
    '## Recipes (the id create_document’s style takes: theme, design, typeface, finish)',
    ...STYLE_RECIPES.map(
      (r) =>
        `- \`${r.id}\` **${r.occasion}**: theme \`${r.theme}\`, design \`${r.design}\`, font \`${r.font}\`, finish \`${r.finish}\``,
    ),
    '',
    '## Finishes',
    ...Object.entries(FINISH_GUIDE).map(([id, note]) => line(id, id, note)),
    '',
    '## Typefaces',
    ...Object.entries(FONT_GUIDE).map(([id, note]) => line(id, labels.font(id), note)),
    '',
    '## Themes',
    ...Object.entries(THEME_GUIDE).map(([id, note]) => line(id, labels.theme(id), note)),
    '',
    '## Page designs',
    ...(Object.entries(DESIGN_GUIDE) as [PageDesignId, StyleNote][]).map(([id, note]) =>
      line(id, labels.design(id), note),
    ),
  ].join('\n');
}
