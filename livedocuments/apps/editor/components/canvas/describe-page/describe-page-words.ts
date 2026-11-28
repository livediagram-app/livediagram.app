// Describe a Page's words for each kind (docs/specs/007-editor/describe-a-page.md "Every kind"): its name, its button,
// the box's placeholder, the examples above the box and the toast once the page is made. One table, so the button,
// the dialog and the toast name the kind alike.
import type { PageKind } from '@livedocuments/document';
import type { DescribeExample } from '@liveworkspace/automations-ui/DescribePrompt';

export type DescribePageWords = {
  // "Describe a Slide": the dialog's title and the button's name.
  title: string;
  // "Make Slide": the dialog's button.
  make: string;
  placeholder: string;
  examples: readonly DescribeExample[];
  // The toast once it is made, by the layout's name where it has one.
  made: (layout: string | null) => string;
};

export const DESCRIBE_PAGE_WORDS: Record<PageKind, DescribePageWords> = {
  slide: {
    title: 'Describe a Slide',
    make: 'Make Slide',
    placeholder:
      'A slide called Q3 Results: revenue up 12%, three new customers, and what we do next.',
    examples: [
      {
        label: 'Agenda',
        text: 'The agenda for our team offsite: welcome, product review, roadmap, lunch, workshops and wrap-up.',
      },
      {
        label: 'Key Figures',
        text: 'Our year in numbers: 1.2 million users, 99.9% uptime, 40 countries and a 4.8 star rating.',
      },
      {
        label: 'Compare Plans',
        text: 'Compare our Free, Pro and Team plans on price, storage, support and how many people can join.',
      },
    ],
    made: (layout) => (layout ? `Added a slide from the ${layout} layout` : 'Added a slide'),
  },
  infographic: {
    title: 'Describe a Page',
    make: 'Make Page',
    placeholder:
      'A page on how to recycle at the office: what goes in each bin, and three tips to waste less.',
    examples: [
      {
        label: 'Five Steps',
        text: 'How a new starter joins the team in five steps: laptop, accounts, buddy, first project, first review.',
      },
      {
        label: 'Fact Sheet',
        text: 'A fact sheet on honey bees: how many live in a hive, how far they fly, and why they matter.',
      },
      {
        label: 'Event Poster',
        text: 'A poster for our summer party on Friday 18 July at 6pm in the garden: food, music and games.',
      },
    ],
    made: (layout) => (layout ? `Added a page from the ${layout} layout` : 'Added a page'),
  },
  article: {
    title: 'Describe an Article',
    make: 'Make Article',
    placeholder:
      'An article for the team on our move to a four-day week: why, how it works, and what changes.',
    examples: [
      {
        label: 'Team Update',
        text: 'A monthly team update: what we shipped, what we learned from customers, and what comes next.',
      },
      {
        label: 'How-To Guide',
        text: 'A how-to guide for running a good retrospective: preparing, the meeting itself, and follow-up.',
      },
      {
        label: 'Proposal',
        text: 'A proposal to add a design review to every project, with the problem, the plan and the cost.',
      },
    ],
    made: () => 'Added an article',
  },
  flashcard: {
    title: 'Describe a Card',
    make: 'Make Card',
    placeholder:
      'A card to open my talk on remote work: a question for the room and the one idea I want them to keep.',
    examples: [
      {
        label: 'Opening',
        text: 'An opening for a talk on design systems: a short story, then why it matters to this room.',
      },
      {
        label: 'Key Point',
        text: 'The key point of my talk: small teams ship faster, with two examples and one number.',
      },
      {
        label: 'Closing',
        text: 'A closing card: the three things to remember, and what I want people to try next week.',
      },
    ],
    made: () => 'Added a card',
  },
};
