// The Working Backwards template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Amazon's PR/FAQ, written
// for a FreshBox launch (the Business Model Canvas's meal-kit business) before anything is built. An article tab that
// opens in Illustrate: the press release, the Customer FAQ and, after a page break, the Internal FAQ, closing on a
// to-do list for the review. Written as Markdown and read by the article's own Markdown reader, so the words stay easy
// to edit here; the first two lines become the title and subtitle, and the one divider the page break.
// Pure data: the tab's pages and writing, merged in by templateCanvasOverrides.
import { parseMarkdownBlocks, type ArticleBlock, type Tab } from '@livediagram/document';
import { articleTabOverrides } from './article-template';

const FLOW_ID = 'art-prfaq';

const PRFAQ = `
# FreshBox Tonight: dinner for two, delivered in two hours, on the table in twenty minutes

# No subscription and no planning: choose by 5pm, cook by 7.

**LEEDS, 3 March 2027.** FreshBox today launched **FreshBox Tonight**, a meal kit you order on the day. Pick one of six dinners by 5pm and a courier brings it by 7, every ingredient weighed out for two and ready to cook in twenty minutes. There is no subscription and no box to skip: you order when you want dinner, and pay £14 for the two of you.

## The problem

Most weeknights start at 6pm with the same question: what are we eating? Busy couples tell us they plan on Sunday, shop on Monday and throw out a third of it by Friday, and the rest of the week is a takeaway they did not want to pay for. A weekly kit helps the planners, but 61% of the people who try one leave because their week does not stay still.

## The solution

FreshBox Tonight takes the plan out of dinner. Open the app after lunch, pick from tonight's six dinners and choose a delivery hour. Our Leeds kitchen packs it fresh, and a courier brings it in a cold bag. Every recipe takes twenty minutes and one pan, with nothing left over.

> "We built FreshBox for people who want to cook but never have the week to plan it. Tonight is FreshBox for the evenings that just happen." Priya Shah, founder of FreshBox

## How it works

1. Choose one of six dinners by 5pm, on your phone or the website
2. Pick a one-hour delivery slot between 5pm and 8pm
3. Cook it in twenty minutes from a card with a photo of every step

> "I order it on the train home and it is at the door before I have found my keys. It is the first thing that has actually stopped us ordering pizza." Sam, a nurse in Headingley

## Getting started

FreshBox Tonight is available today across Leeds, from £14 for two. Download the FreshBox app or visit freshbox.example/tonight. Subscribers get their first Tonight dinner free.

---

# Customer FAQ

## Do I need a subscription?

No. You order Tonight when you want it and pay for that dinner only. Subscribers can add a Tonight dinner to any week.

## What if I am not in when it arrives?

Choose Leave Safe and the courier leaves it in its cold bag, which keeps it cool for four hours. We send a photo when it is delivered.

## Can I cater for allergies?

Every dinner lists all 14 major allergens, and two of each night's six are vegetarian. We cannot promise a kitchen free from nuts or gluten.

## How fresh is it?

It is packed in our Leeds kitchen within two hours of reaching you, from the same six farms as our weekly boxes.

## Where do you deliver?

Everywhere inside the Leeds ring road at launch, then York and Harrogate in the summer.

# Internal FAQ

## Why now?

Our courier partner already runs two-hour slots across Leeds, and our kitchen stands idle after 2pm. Tonight uses both at almost no fixed cost.

## How big is the opportunity?

38,000 households in Leeds order a weeknight takeaway at least twice a week (our local panel, January 2027). Winning 5% of them once a fortnight is 950 dinners a week: about £690,000 a year in revenue.

## What does it cost to build?

Ten weeks for a team of five: same-day ordering in the app, a packing screen for the kitchen, and slot booking through the courier's API. The kitchen needs one more shift a day, about £1,800 a week.

## What are the riskiest assumptions?

- People will pay £14 for a dinner they still have to cook
- The kitchen can pack 150 orders between 2pm and 6pm
- Couriers can hold a one-hour slot at the evening peak

## What would make us stop?

Fewer than one in five first-time customers ordering again within a month of the pilot, or more than one delivery in ten arriving late.

## How will we know it worked?

- **Repeat rate:** 35% order again within 30 days
- **On time:** 95% of dinners arrive inside their slot
- **Margin:** £3.50 a dinner after delivery
- **Cannibalisation:** under 10% of Tonight orders come from subscribers skipping a box

# Before the review

- [x] The press release reads well to someone outside the team
- [ ] Every number has its source beside it
- [ ] Finance has checked the margin
- [ ] A pilot with 200 households is agreed
`;

// The PR/FAQ's blocks, each with an id of its own and the same on every build: the first two headings are the title
// and subtitle, the divider the page break before the FAQs.
function workingBackwardsBlocks(): ArticleBlock[] {
  return parseMarkdownBlocks(PRFAQ.trim()).map((block, i): ArticleBlock => {
    const id = `b-prfaq-${i + 1}`;
    if (block.type === 'divider') return { id, type: 'pageBreak' };
    if (i < 2 && block.type === 'paragraph')
      return { ...block, id, style: i === 0 ? 'title' : 'subtitle' };
    return { ...block, id };
  });
}

/** The Working Backwards template's pages and writing (opens in Illustrate, in the Report look). */
export function workingBackwardsOverrides(): Partial<Tab> {
  return articleTabOverrides(FLOW_ID, workingBackwardsBlocks(), { look: 'report' });
}
