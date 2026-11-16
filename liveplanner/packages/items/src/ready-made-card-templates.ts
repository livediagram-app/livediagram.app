// The card templates the ready-made card types hold (docs/specs/026-plan/plan-templates.md "Card templates the
// ready-made types hold"): a board that brings one of these types (a Plan template's or a preset's) offers its kinds
// of card already filled in. Each is the type's own once brought, renamed, changed or deleted like a person's. Pure
// data: only what a template may hold (item-types.md "Card templates"), and no title, so a card takes its type's
// new-card title. brought-types.test.ts holds every one to readCardTemplates, refusing.
import type { CardTemplate } from './card-templates';

type Check = readonly [text: string, done?: boolean];

const checklist = (rows: readonly Check[]) => rows.map(([text, done = false]) => ({ text, done }));

const template = (id: string, name: string, fields: CardTemplate['fields']): CardTemplate => ({
  id,
  name,
  fields,
});

export const READY_MADE_CARD_TEMPLATES = {
  bug: [
    template('tp-crash', 'Crash', {
      description: 'What were you doing when it closed?',
      'f-steps-to-reproduce': '1. Open …\n2. …\n3. The app closes\n\nExpected:\nActual:',
      labels: ['crash'],
      checklist: checklist([
        ['Reproduced on the latest build'],
        ['Crash log attached'],
        ['Versions affected noted'],
      ]),
    }),
    template('tp-visual-glitch', 'Visual Glitch', {
      description: 'What looks wrong, and where:',
      labels: ['ui'],
      checklist: checklist([
        ['Screenshot attached'],
        ['Checked in light and dark'],
        ['Checked on a phone'],
      ]),
    }),
    template('tp-slow-screen', 'Slow Screen', {
      description: 'Which screen, and what you were waiting for:',
      labels: ['performance'],
      checklist: checklist([
        ['Timed it: how long it takes'],
        ['Noted how much data was on screen'],
        ['Compared with the last release'],
      ]),
    }),
  ],
  story: [
    template('tp-user-story', 'User Story', {
      description: 'As a …\nI want …\nSo that …',
      checklist: checklist([
        ['Acceptance criteria agreed'],
        ['Designs linked'],
        ['Estimated by the team'],
      ]),
    }),
    template('tp-spike', 'Spike', {
      description: 'The question to answer:\n\nTime box:',
      labels: ['spike'],
      checklist: checklist([['Options written up'], ['Recommendation shared with the team']]),
    }),
  ],
  request: [
    template('tp-feature-request', 'Feature Request', {
      description: 'What they want to do:\n\nWhy it matters to them:\n\nHow they do it today:',
      labels: ['feature'],
    }),
    template('tp-access-request', 'Access Request', {
      description: 'Which tool or folder:\n\nWhat level of access:\n\nApproved by:',
      labels: ['access'],
    }),
  ],
  content: [
    template('tp-blog-post', 'Blog Post', {
      'f-channel': 'Blog',
      checklist: checklist([
        ['Outline'],
        ['First draft'],
        ['Edit'],
        ['Images with alt text'],
        ['Search title and summary'],
      ]),
    }),
    template('tp-newsletter', 'Newsletter', {
      'f-channel': 'Newsletter',
      checklist: checklist([['Lead story'], ['Every link checked'], ['Test send'], ['Scheduled']]),
    }),
    template('tp-social-post', 'Social Post', {
      'f-channel': 'Social',
      checklist: checklist([['Copy written'], ['Image or video'], ['Alt text'], ['Scheduled']]),
    }),
  ],
  candidate: [
    template('tp-interview-loop', 'Interview Loop', {
      checklist: checklist([
        ['Screen call'],
        ['Skills interview'],
        ['Team interview'],
        ['References'],
        ['Decision'],
      ]),
    }),
    template('tp-referral', 'Referral', {
      'f-source': 'Referral',
      description: 'Referred by:\n\nWhy they would be great:',
      checklist: checklist([['Thank the referrer'], ['Screen call'], ['Decision']]),
    }),
  ],
  'onboarding-task': [
    template('tp-laptop-and-accounts', 'Laptop and Accounts', {
      checklist: checklist([
        ['Order the laptop'],
        ['Email and calendar'],
        ['Team chat'],
        ['Password manager'],
        ['Access to the tools they need'],
      ]),
    }),
    template('tp-first-week-plan', 'First Week Plan', {
      checklist: checklist([
        ['Meet the team'],
        ['Coffee with their buddy'],
        ['A first small task'],
        ['End-of-week check-in'],
      ]),
    }),
  ],
  deal: [
    template('tp-inbound-lead', 'Inbound Lead', {
      'f-source': 'Inbound',
      checklist: checklist([
        ['Qualify: budget'],
        ['Qualify: decision maker'],
        ['Qualify: timeline'],
        ['Book a demo'],
      ]),
    }),
    template('tp-renewal', 'Renewal', {
      labels: ['renewal'],
      checklist: checklist([['Usage review'], ['Pricing agreed'], ['Contract sent'], ['Signed']]),
    }),
  ],
  ticket: [
    template('tp-somethings-broken', 'Something’s Broken', {
      description: 'What they tried, and what happened instead:',
      labels: ['bug'],
      checklist: checklist([
        ['Steps to reproduce'],
        ['Screenshot or recording'],
        ['Passed to engineering'],
      ]),
    }),
    template('tp-billing-question', 'Billing Question', {
      labels: ['billing'],
      checklist: checklist([['Find the invoice'], ['Explain the charge'], ['Refund if due']]),
    }),
    template('tp-refund-request', 'Refund Request', {
      labels: ['refund'],
      checklist: checklist([
        ['Order found'],
        ['Within the refund window'],
        ['Refund issued'],
        ['Customer told'],
      ]),
    }),
  ],
} satisfies Readonly<Record<string, CardTemplate[]>>;
