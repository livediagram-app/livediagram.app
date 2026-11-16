// More written templates (docs/specs/008-canvas/canvas-and-palette.md "Written documents"), read and built exactly as
// article-templates.ts reads its own: a product one-pager, a research report, a newsletter, a case study and an
// onboarding handbook. Each uses what an article holds the way the real document would: the research report its
// title page, contents and footnotes; the newsletter its contents and links; the case study its results in a table and
// a footnote; the handbook its checklists, contents and tables. Pure data.
import type { ArticleTemplate } from './article-templates';

export type MoreArticleTemplateKind =
  'product-one-pager' | 'research-report' | 'newsletter' | 'case-study' | 'onboarding-handbook';

export const MORE_ARTICLE_TEMPLATES: Readonly<Record<MoreArticleTemplateKind, ArticleTemplate>> = {
  'product-one-pager': {
    flow: 'art-one-pager',
    // One page that holds everything: narrow margins, the smaller text, a header with the date it was last read.
    style: {
      look: 'clean',
      margins: 'narrow',
      textSize: 'small',
      header: { left: 'Lumen · Product', right: '{date}' },
    },
    columns: [
      [0.28, 0.72],
      [0.46, 0.22, 0.32],
    ],
    markdown: `
# Lumen Recall

# Product one-pager · Draft for review · Owner: Mia Chen

# The problem

People write notes in every meeting and find almost none of them again. In our last survey, seven in ten Lumen users said they had rewritten a note they knew they already had.

# Who it is for

Team leads with back-to-back meetings, who keep their notes in Lumen but never have time to file them.

# What we are building

| Piece | What it does |
| --- | --- |
| Meeting match | Reads your calendar and pins the notes about each meeting to it |
| Recall card | Shows those notes five minutes before the meeting starts |
| Quiet mode | Never shows a note while someone is presenting your screen |

# How we will know it worked

| Measure | Today | Goal by October |
| --- | --- | --- |
| Notes reopened a week, per person | 1.4 | 3 |
| People who open a Recall card | None | 40% |
| "Cannot find my note" tickets | 120 a month | Under 40 |

# Not in this release

- Notes from email or chat apps
- Recall on the web: phones and desktop come first

# Open questions

- [ ] Do we ask before reading someone's calendar, every time or once?
- [ ] What does Recall show when two meetings overlap?
`,
  },
  'research-report': {
    flow: 'art-research',
    style: {
      look: 'report',
      header: { left: 'Four Days, Same Work?', right: 'Research Report' },
      footer: { left: 'Brightwater Studio', right: 'Page {page} of {pages}' },
      differentFirstPage: true,
    },
    columns: [[0.2, 0.52, 0.28]],
    markdown: `
# Four Days, Same Work?

# What a six-month trial of the four-day week did to output and wellbeing at Brightwater Studio

**Prepared by** Ana Ruiz, People and Research

**Published** 2 February 2027

---

[TOC 2]

# Summary

From June to November 2026, all 26 people at Brightwater Studio worked four days a week for the same pay. Output held steady, sick days fell by a third, and the share of people who often felt burnt out halved.[^1] We recommend keeping the four-day week, with the changes set out below.

# Background

Trials of the four-day week in the UK and in Iceland found that most organisations kept their output while their people were healthier and less likely to leave.[^2] We wanted to know whether a small design studio, where client deadlines set the pace, would see the same.

# Method

We compared the six months of the trial with the same six months of 2025.

| Measure | Source | How often |
| --- | --- | --- |
| Output | Projects delivered and billable hours | Monthly |
| Wellbeing | A ten-question anonymous survey | Before, at three months, at the end |
| Sick days | HR records | Monthly |
| Clients | Satisfaction scores after each project | Each project |

# Findings

## Output held steady

The studio delivered 21 projects in the trial against 20 in the same months of 2025, with 4% fewer billable hours.[^3]

## People were healthier

Sick days fell from 61 to 40, and the share of people who said they often felt burnt out fell from 46% to 23%.

## Clients did not notice

Client satisfaction stayed at 4.6 out of 5. Two clients asked about Fridays; neither moved their work elsewhere.

# Recommendations

1. Keep the four-day week, with Friday as the day off for most people
2. Keep one person on call each Friday for client emergencies, on a rota
3. Survey again in six months, and share the results with the whole studio

# Limitations

Twenty-six people is a small group, and 2026 was a busier year than 2025. We cannot tell how much of the change came from the shorter week and how much from the lift of trying something new.

[^1]: Burnout measured by the survey question "How often do you feel burnt out at work?", answered "often" or "always".
[^2]: Autonomy, "The results are in: the UK's four-day week pilot", February 2023; Haraldsson and Kellam, "Going Public: Iceland's journey to a shorter working week", 2021.
[^3]: Billable hours from the time-tracking system; a project counted once its client signed it off.
`,
  },
  newsletter: {
    flow: 'art-newsletter',
    style: {
      look: 'bold',
      header: { left: 'The Harbour Post', right: 'Issue 14 · November 2026' },
      footer: { left: 'harbourcoffee.example', right: 'Page {page} of {pages}' },
    },
    columns: [[0.26, 0.3, 0.44]],
    markdown: `
# The Harbour Post

# News from the roastery · Issue 14 · November 2026

[TOC 1]

# Hello from Bristol

The nights are drawing in, the roaster is running six days a week, and our winter blend is back. Here is what has been happening, and what is coming up.

# Winter Blend returns

After two years away, Winter Blend is back on 1 December: a heavy, chocolatey coffee made for long, cold mornings. Subscribers get the first bags, a week before anyone else.

> "We roast it a little darker than our summer coffees, so it stands up to milk. It tastes like a mince pie without the pastry." Leo Marsh, head roaster

# New on the shelf

| Coffee | From | Tastes like |
| --- | --- | --- |
| Winter Blend | Brazil and Ethiopia | Dark chocolate, orange peel, spice |
| La Esperanza | Colombia | Red apple, caramel, almond |
| Kiambu AA | Kenya | Blackcurrant, grapefruit, brown sugar |

# What is on

- **Latte art night**, Thursday 4 December, 7pm at the café: free, bring a friend
- **Roastery tour**, Saturday 13 December, 10am: £12, with a bag to take home
- **Christmas opening**: closed on 25 and 26 December, open as usual from the 27th

# One last thing

Thank you for reading, and for every cup. Reply to this email and tell us what you would like to read about next time.

[Read past issues](https://harbourcoffee.example/news) · [Manage your subscription](https://harbourcoffee.example/account)
`,
  },
  'case-study': {
    flow: 'art-case-study',
    style: {
      look: 'report',
      header: { left: 'Northwind Studio', right: 'Case Study' },
      footer: { left: 'northwind.example', right: 'Page {page} of {pages}' },
    },
    columns: [
      [0.24, 0.24, 0.28, 0.24],
      [0.4, 0.2, 0.2, 0.2],
    ],
    markdown: `
# Field Bakery: Online Orders Up 64%

# How a new shop made the bread subscription the easy choice. A case study from Northwind Studio.

| Client | Industry | Project | Timeline |
| --- | --- | --- | --- |
| Field Bakery, Bristol | Food and drink | A new online shop | Ten weeks, autumn 2025 |

# The challenge

Field Bakery sold bread, cakes and a weekly bread subscription from a website built for its first shop. By 2025 online orders were a third of its sales, but the site was slow on a phone and the subscription was hard to find. Four in ten people who started a checkout gave up before paying.

# What we did

1. **Listened:** we interviewed twelve customers and watched six of them order
2. **Redesigned the shop** around the weekly order, with the subscription one tap from every loaf
3. **Rebuilt checkout** in two steps, with Apple Pay and Google Pay
4. **Launched in stages:** subscribers first, then everyone a fortnight later

# The results

In the first quarter after launch, against the same quarter a year before:[^1]

| Measure | Before | After | Change |
| --- | --- | --- | --- |
| Online orders a month | 2,150 | 3,530 | +64% |
| Checkouts completed | 58% | 81% | +23 points |
| Bread subscribers | 410 | 960 | +134% |

> "Our regulars order on the bus now, not on a Sunday evening. The new shop pays for itself every month." Hannah Reid, founder of Field Bakery

# What made the difference

- The subscription moved from a menu to the product page, where people decide
- Checkout shrank from six steps to two
- The shop loads in under two seconds on a phone, down from seven

# Work with us

Northwind Studio designs and builds online shops for independent food and drink brands. Say hello at hello@northwind.example.

[^1]: January to March 2026 against January to March 2025, from Field Bakery's own shop reports.
`,
  },
  'onboarding-handbook': {
    flow: 'art-handbook',
    style: {
      look: 'clean',
      header: { left: '{name}', right: 'Harbour Studio' },
      footer: { left: 'Updated by the People team', right: 'Page {page} of {pages}' },
    },
    columns: [
      [0.3, 0.36, 0.34],
      [0.3, 0.7],
    ],
    markdown: `
# Welcome to Harbour Studio

# Your handbook for the first month. Keep it open: it answers most first-week questions.

[TOC 1]

# Before your first day

- [ ] Sign your contract and send your bank details to people@harbour.example
- [ ] Choose a laptop: it will be set up and waiting on your desk
- [ ] Join the studio chat from the invite in your email

# Your first week

- [ ] Monday: breakfast with the team at 9:30, then set up your laptop with Jo
- [ ] Tuesday: sit in on a client call, and read two recent project write-ups
- [ ] Wednesday: your first one-to-one with your manager
- [ ] Thursday: pick a small task from the board and ship it with your buddy
- [ ] Friday: show and tell at 4pm, then drinks

# Who to ask

| For | Ask | Where |
| --- | --- | --- |
| Your work and goals | Your manager | Your weekly one-to-one |
| Anything at all | Jo Lindqvist, your buddy | #help-new-joiners |
| Pay, leave and contracts | Ana Ruiz, People | people@harbour.example |
| Laptops and accounts | Tom Ward, IT | #it-help |

# How we work

**We write things down.** Decisions live in docs, not in hallway chats, so the people who were not there can catch up.

**We ask early.** A question on your first morning saves a day of rework later. Nobody minds.

**We keep Fridays light.** No client meetings after 2pm, so the week ends with time to tidy up and share.

# Tools you will use

| Tool | What for |
| --- | --- |
| Studio docs | Briefs, proposals, decks and this handbook |
| The project board | Every project's tasks, owners and dates |
| Studio chat | Day-to-day talk; email is for clients |

# Time off and pay

You have 28 days of holiday a year, plus public holidays.[^1] Book time off at least two weeks ahead, and tell your project lead. Pay day is the last working day of each month.[^2]

# Your first month

By the end of your first month you will have shipped real work, met every team and had your first check-in with your manager. If anything in this handbook is wrong or missing, tell Ana, and it will be fixed for the next person.

[^1]: Pro rata for part-time roles. Up to five unused days carry over to the next year.
[^2]: Expenses sent in by the 20th are paid with that month's salary.
`,
  },
};
