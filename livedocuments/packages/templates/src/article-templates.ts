// The written templates (docs/specs/008-canvas/canvas-and-palette.md "Written documents"): articles written out as a
// real document of their kind, each using what an article holds the way that document would (tables, a table of
// contents, a header and footer, page numbers, a code block). Written as Markdown and read by the article's own
// Markdown reader, so the words stay easy to edit here; the first two lines become the title and subtitle, and a
// divider a page break. Pure data: the tab's pages and writing, merged in by templateCanvasOverrides.
import {
  parseMarkdownBlocks,
  type ArticleBlock,
  type ArticleStyle,
  type Tab,
} from '@livedocuments/document';
import { articleTabOverrides } from './article-template';

export type ArticleTemplateKind =
  | 'meeting-notes'
  | 'lesson-plan'
  | 'business-proposal'
  | 'design-doc'
  | 'status-report'
  | 'cover-letter';

type ArticleTemplate = {
  // The flow's id, and the prefix of its blocks' ids.
  flow: string;
  style: ArticleStyle;
  // Each table's column shares, in the order the tables appear (a table not listed keeps even columns).
  columns?: readonly (readonly number[])[];
  markdown: string;
};

const ARTICLE_TEMPLATES: Readonly<Record<ArticleTemplateKind, ArticleTemplate>> = {
  'meeting-notes': {
    flow: 'art-meeting',
    style: {
      look: 'clean',
      header: { left: '{name}', right: '{date}' },
      pageNumbers: true,
    },
    columns: [
      [0.3, 0.7],
      [0.45, 0.3, 0.25],
    ],
    markdown: `
# Product Team Weekly

# Tuesday 9 March, 10:00 to 10:45, Room 4 and online

| Role | Who |
| --- | --- |
| Chair | Priya Shah |
| Notes | Sam Okafor |
| Attending | Lee Park, Mia Chen, Tom Ward, Ana Ruiz |
| Apologies | Jordan Blake |

## Agenda

1. Last week's actions
2. Beta feedback: what we heard
3. Launch date: go or wait
4. Anything else

## Notes

**Beta feedback.** Mia shared the survey: 212 replies, 78% would recommend the beta to a friend. The top complaint is slow search on large notebooks, raised by one person in five.

**Launch date.** Lee thinks search must be fixed first. Tom pointed out the fix is already in review and can ship in the first week. We agreed to keep the date and to say nothing in the launch post about search speed until the fix is out.

## Decisions

| Decision | Owner | Date |
| --- | --- | --- |
| Launch on 23 March as planned | Priya | 9 March |
| Search fix ships in launch week | Tom | 9 March |
| Survey the beta again in May | Mia | 9 March |

## Actions

- [ ] Tom: merge the search fix and share timings by Friday
- [ ] Mia: send the survey summary to the whole team
- [ ] Lee: draft the launch post for review on Monday
- [x] Sam: book the launch-day room

## Next meeting

Tuesday 16 March, same time. Ana will chair.
`,
  },
  'lesson-plan': {
    flow: 'art-lesson',
    style: {
      look: 'notebook',
      footer: { left: 'Year 7 Science', right: 'Page {page}' },
    },
    columns: [[0.18, 0.32, 0.5]],
    markdown: `
# The Water Cycle

# Year 7 Science, one hour, Lab 2

## Learning objectives

By the end of the lesson, every student can:

1. Name the four stages of the water cycle
2. Explain what makes water evaporate and condense
3. Draw and label the cycle from memory

## Prepare beforehand

- A kettle, a cold metal tray and a bowl of ice
- The water cycle worksheet, one each
- Mini whiteboards and pens

## The lesson

| Time | Stage | What happens |
| --- | --- | --- |
| 0 to 5 | Starter | Ask: "Where was this rain a week ago?" Pairs write one guess each. |
| 5 to 15 | Demonstration | Boil the kettle under the cold tray. Students watch the steam condense and drip, then say what they saw. |
| 15 to 30 | Explain | Walk through evaporation, condensation, precipitation and collection on the board, one stage at a time. |
| 30 to 45 | Activity | Students draw and label the cycle on their worksheet, adding an arrow and one sentence for each stage. |
| 45 to 55 | Check | Mini whiteboards: show the stage I describe. Note who hesitates. |
| 55 to 60 | Plenary | Back to the starter: where was the rain a week ago? Hear three answers. |

## Differentiation

- **Support:** a worksheet with the four stage names given, to place on the drawing
- **Stretch:** add transpiration from plants, and explain why the sea is salty but rain is not

## Homework

Find one photo at home or outside that shows a stage of the water cycle, and write two sentences on what is happening in it.

> Ask, show, explain, try, check: one idea, five ways in.
`,
  },
  'business-proposal': {
    flow: 'art-proposal',
    style: {
      look: 'report',
      header: { left: 'Northwind Studio', right: 'Proposal for Harbour Coffee' },
      footer: { left: 'Confidential', right: 'Page {page} of {pages}' },
      differentFirstPage: true,
    },
    columns: [
      [0.3, 0.2, 0.5],
      [0.6, 0.4],
    ],
    markdown: `
# A New Website for Harbour Coffee

# A proposal from Northwind Studio, 12 April 2027

**Prepared for** Dana Ellis, Founder, Harbour Coffee

**Prepared by** Lee Park, Northwind Studio

[TOC 1]

---

# Summary

Harbour Coffee sells more beans online every month, but the website was built for a single café. We propose a new site in eight weeks, with a shop that makes subscriptions the easy choice, for a fixed price of £24,000.

# The problem

Three things hold the current site back:

- **Checkout takes six steps**, and half of the people who start it leave before paying
- **Subscriptions are hidden** under the menu, though subscribers spend four times as much in a year
- **The site is slow on a phone**, where seven in ten visitors arrive

# Our approach

We start with your customers, not the design. In the first two weeks we talk to ten of them and watch how they buy, then design a shop around what they do.

1. **Discover:** interviews, your analytics and a review of the current site
2. **Design:** a clickable prototype, tested with five customers
3. **Build:** the site, the shop and subscriptions on your current payments
4. **Launch:** a soft launch to subscribers, then everyone

# Timeline

| Phase | Weeks | What you get |
| --- | --- | --- |
| Discover | 1 to 2 | A short report of what we learned |
| Design | 3 to 4 | A tested prototype to sign off |
| Build | 5 to 7 | The working site on a preview link |
| Launch | 8 | The new site live, and a handover session |

# Investment

| Item | Price |
| --- | --- |
| Discovery and design | £8,000 |
| Build and launch | £14,000 |
| Three months of support | £2,000 |
| **Total** | **£24,000** |

Half on signing, half on launch. Prices exclude VAT.

# Why Northwind

We have built shops for eleven independent food and drink brands since 2021. Our last, for Field Bakery, raised online orders by 64% in its first quarter.

# Next steps

- [ ] A thirty-minute call to answer your questions
- [ ] Sign the proposal by 30 April to start on 10 May
`,
  },
  'design-doc': {
    flow: 'art-design-doc',
    style: {
      look: 'clean',
      header: { left: 'Design Doc: Offline Sync', right: 'Status: In Review' },
      pageNumbers: true,
    },
    columns: [[0.22, 0.39, 0.39]],
    markdown: `
# Offline Sync for the Notes App

# Author: Tom Ward. Reviewers: Mia Chen, Lee Park. Last updated 2 March.

[TOC 2]

## Context

Today every edit goes straight to the server. On a train or a plane, the app shows a spinner and the edit is lost if the app is closed. Offline editing is the most requested feature in the last two surveys.

## Goals

- Edit any note offline, and keep every edit when the app closes
- Merge edits from two devices without losing either
- Sync within five seconds of coming back online

## Non-goals

- Offline search across notes never opened on the device
- Sharing or inviting people while offline

## Proposed design

Each device keeps a local queue of changes, saved to disk before they are shown. When the device is online, a sync worker sends the queue in order and applies what the server sends back.

\`\`\`
type Change = {
  noteId: string;
  version: number;
  ops: Op[];
  madeAt: number;
};
\`\`\`

The server merges changes by operation, not by whole note, so two people typing in different paragraphs never overwrite each other.

## Alternatives considered

| Option | For | Against |
| --- | --- | --- |
| Last write wins | Simple to build | Loses edits whenever two devices edit |
| Lock while editing | No conflicts | Useless offline, the case we are solving |
| Merge by operation | Keeps every edit | More work on the server and in tests |

## Rollout

1. Behind a flag for the team, two weeks
2. To 10% of users, watching sync errors and support tickets
3. To everyone, once errors stay under 0.1% for a week

## Open questions

- [ ] How long do we keep a queue for a device that never comes back?
- [ ] Do we show people when a merge changed their text?
`,
  },
  'status-report': {
    flow: 'art-status',
    style: {
      look: 'report',
      header: { left: 'Website Relaunch', right: 'Status Report, March' },
      footer: { left: '{name}', right: 'Page {page} of {pages}' },
    },
    columns: [[0.26, 0.16, 0.58]],
    markdown: `
# Website Relaunch: March Status

# Reporting period 1 to 31 March. Owner: Ana Ruiz.

## Headline

**On track for launch on 28 April.** Design is signed off and the build is two-thirds done. One risk has grown: the payments change needs the bank's approval, which is not yet in.

## Workstreams

| Workstream | Status | This month |
| --- | --- | --- |
| Design | Done | Prototype tested with eight customers and signed off on 12 March |
| Build | On track | Shop, account pages and search built; checkout in progress |
| Content | At risk | 40 of 65 product pages written; a freelancer joins on 4 April |
| Payments | Blocked | Waiting for the bank to approve the new payment page |

## Numbers

- **Budget:** £61,000 spent of £90,000 (68%), against 70% planned
- **Scope:** 3 changes requested, 2 accepted, 1 moved to after launch
- **Quality:** 14 open bugs, none blocking launch

## Risks and issues

| Risk | Impact | What we are doing |
| --- | --- | --- |
| Bank approval is late | Launch slips a week | Escalated on 28 March; a fallback page is ready |
| Product pages unfinished | Launch with gaps | Freelancer booked; the 20 best sellers first |

## Next month

1. Finish checkout and test it with real cards
2. Write the last 25 product pages
3. Run the launch rehearsal on 21 April

## Decisions needed

- [ ] Approve the fallback payment page if the bank has not replied by 11 April
`,
  },
  'cover-letter': {
    flow: 'art-cover-letter',
    style: { look: 'classic', margins: 'wide' },
    markdown: `
# Alex Morgan

# 14 Elm Street, Bristol BS1 4QA · alex.morgan@example.com · 07700 900123

2 May 2027

Jordan Blake, Head of Customer Experience, Harbour Coffee, Bristol BS8 1AA

**Dear Jordan,**

I am writing to apply for the role of Customer Experience Lead at Harbour Coffee. I have been a subscriber for three years, and the note that comes with every bag is the reason I tell friends about you. I would love to help more of your customers feel that way.

For the last four years I have led a support team of eight at Field Bakery. In that time we cut our reply time from two days to four hours, and raised our customer satisfaction score from 71% to 92%. I did it by listening first: every month I read a hundred conversations myself, and every change we made started there.

I would bring the same habit to Harbour Coffee, along with a plan for your first subscriber survey, which I would be glad to talk you through. Thank you for reading, and I hope we can speak soon.

Yours sincerely,

Alex Morgan
`,
  },
};

/** The kinds written as articles here. */
export function isArticleTemplate(kind: string): kind is ArticleTemplateKind {
  return Object.hasOwn(ARTICLE_TEMPLATES, kind);
}

// A template's blocks, each with an id of its own and the same on every build: the first two headings are the title
// and subtitle, a divider the page break, and each table's columns its own shares.
function articleTemplateBlocks(kind: ArticleTemplateKind): ArticleBlock[] {
  const t = ARTICLE_TEMPLATES[kind];
  let table = 0;
  return parseMarkdownBlocks(t.markdown.trim()).map((block, i): ArticleBlock => {
    const id = `b-${t.flow.slice(4)}-${i + 1}`;
    if (block.type === 'divider') return { id, type: 'pageBreak' };
    if (i < 2 && block.type === 'paragraph')
      return { ...block, id, style: i === 0 ? 'title' : 'subtitle' };
    if (block.type === 'table') {
      const shares = t.columns?.[table++];
      if (shares && shares.length === block.cols.length)
        return { ...block, id, cols: block.cols.map((c, n) => ({ ...c, w: shares[n]! })) };
    }
    return { ...block, id };
  });
}

/** A written template's pages and writing (opens in Pages). */
export function articleTemplateOverridesFor(kind: ArticleTemplateKind): Partial<Tab> {
  const t = ARTICLE_TEMPLATES[kind];
  return articleTabOverrides(t.flow, articleTemplateBlocks(kind), t.style);
}
