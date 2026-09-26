import type { FeatureProps } from '@/components/Section';
import { getLandingSection, type LandingSection } from '@/lib/landing-content';

// The landing page's story (spec/16): five beats, each grouping two to four
// of the LANDING_SECTIONS categories under one idea. A beat only NAMES
// section ids and feature titles; the copy it shows for a category (its
// title, feature count, art) is read from LANDING_SECTIONS, so a beat can't
// drift from the /features/<id> page it links to. landing-beats.test.ts pins
// that every section is in exactly one beat and every showcase pick resolves.

export type LandingBeat = {
  // The beat's anchor on the landing page.
  id: string;
  title: string;
  description: string;
  // The categories this beat covers, lead first, each with the short label
  // its chip shows.
  sections: { id: string; label: string }[];
  // Label for the primary link into the lead category's page.
  cta: string;
  // The showcase's scenes: [section id, feature title], three of them.
  showcase: [string, string][];
};

export const LANDING_BEATS: LandingBeat[] = [
  {
    id: 'create',
    title: 'Start in seconds, go as deep as you like',
    description:
      'Open a link and draw. When the idea grows, the same canvas takes images, tables, icons, mind maps and freehand sketches, and guides and snapping keep it neat while you work.',
    sections: [
      { id: 'simple', label: 'The basics' },
      { id: 'content', label: 'Rich content' },
      { id: 'express', label: 'Drawing and text' },
      { id: 'assist', label: 'Smart assists' },
    ],
    cta: 'See how simple it is',
    showcase: [
      ['simple', 'Start in one click'],
      ['content', 'Mind maps from the keyboard'],
      ['express', 'Sketch freehand, or let it snap to shape'],
    ],
  },
  {
    id: 'together',
    title: 'Built for working together',
    description:
      'Share a link and your team is on the canvas with you: live cursors, comments on any element, actions assigned to teammates, and a big system split across tabs that link to each other.',
    sections: [
      { id: 'collaboration', label: 'Collaboration' },
      { id: 'tabs', label: 'Tabs' },
    ],
    cta: 'Explore collaboration',
    showcase: [
      ['collaboration', 'Live presence'],
      ['collaboration', 'Comments on any element'],
      ['tabs', 'Link elements across tabs'],
    ],
  },
  {
    id: 'present',
    title: 'Present straight from the canvas',
    description:
      'Turn what you drew into slides, point with a laser, spotlight the one piece you mean, and let arrows show the flow. No export, no second tool.',
    sections: [
      { id: 'present', label: 'Presenting' },
      { id: 'motion', label: 'Animation' },
    ],
    cta: 'Explore the presentation tools',
    showcase: [
      ['present', 'Slides made from what you drew'],
      ['present', 'Laser pointer for presenting'],
      ['motion', 'Arrows that show the flow'],
    ],
  },
  {
    id: 'yours',
    title: 'Make it yours, keep it tidy',
    description:
      'Start from a template, recolour with a theme or build your own, then keep a busy canvas in order with layers, locking and a format painter.',
    sections: [
      { id: 'customise', label: 'Customisation' },
      { id: 'refine', label: 'Organising' },
    ],
    cta: 'Explore customisation',
    showcase: [
      ['customise', 'Twenty-six preset themes'],
      ['refine', 'Photoshop-style layers'],
      ['refine', 'Format painter'],
    ],
  },
  {
    id: 'open',
    title: 'Open, private, and connected',
    description:
      'MIT-licensed and self-hostable. Your work saves itself and reverts in one click, a diagram can live only in your browser, and your AI tools can read and build diagrams for you.',
    sections: [
      { id: 'foundations', label: 'Open source' },
      { id: 'reliability', label: 'Reliability' },
      { id: 'connect', label: 'Tools and AI' },
    ],
    cta: 'Explore the open foundations',
    showcase: [
      ['connect', 'Build diagrams with AI'],
      ['reliability', 'Activity log with one-click revert'],
      ['foundations', 'Work fully offline'],
    ],
  },
];

/** A beat's categories, lead first. Throws on an unknown id (a test pins them). */
export function beatSections(beat: LandingBeat): (LandingSection & { label: string })[] {
  return beat.sections.map(({ id, label }) => {
    const section = getLandingSection(id);
    if (!section) throw new Error(`Landing beat "${beat.id}" names unknown section "${id}"`);
    return { ...section, label };
  });
}

/** The features a beat's showcase stacks, in order. Throws on an unknown pick. */
export function beatShowcase(beat: LandingBeat): FeatureProps[] {
  return beat.showcase.map(([sectionId, title]) => {
    const item = getLandingSection(sectionId)?.items.find((i) => i.title === title);
    if (!item) throw new Error(`Landing beat "${beat.id}" shows unknown "${sectionId}: ${title}"`);
    return item;
  });
}
