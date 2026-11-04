import type { HeroSceneKey } from '@/components/hero-scenes';
import {
  ApiArt,
  AssignedActionsArt,
  AvatarModeArt,
  BringFocusArt,
  CommentsArt,
  ComponentsArt,
  ExpiryArt,
  ExportArt,
  FacilitatorArt,
  FollowAlongArt,
  LaserArt,
  LiveImageArt,
  LockArt,
  McpArt,
  PresenceArt,
  RealtimeArt,
  RevokeArt,
  SelectionGlowArt,
  SessionToolsArt,
  ShareLinksArt,
  SpotlightArt,
  TabsArt,
  TeamsArt,
  TemplatesArt,
  TimelineFeedArt,
  UndoRedoArt,
} from '@/components/FeatureArt';
import type { FeatureProps } from '@liveworkspace/marketing-site/components/Section';

/**
 * A feature category: one of the app's core features, each a story beat on the
 * landing page and a page of its own at /features/<id>
 * (docs/specs/019-marketing/marketing-site.md "Story beats").
 */
export type LandingSection = {
  id: string;
  /** The plain name of the feature, shown beside the beat's number (e.g. "Whiteboard"). */
  label: string;
  /** The headline: the beat's title on the landing page and the category page's h1. */
  title: string;
  description: string;
  /** The category page's meta description: 50 to 160 characters, so a search result shows it whole. */
  metaDescription: string;
  /**
   * The label for the beat's link into its category page. Hand written rather
   * than derived from the title, which read awkwardly ("Explore work on it
   * together, live"). Keep it short and verb-led, e.g. "Explore the whiteboard".
   */
  cta: string;
  /** The hero scene that plays beside the beat and on the category page (components/hero-scenes.tsx). */
  scene: HeroSceneKey;
  /** The feature titles the beat lists, each a link to its card; every one names an item below. */
  highlights: string[];
  items: FeatureProps[];
};

/**
 * The feature categories, in the order the landing page tells them: the Space you meet in, the
 * workshop you run in it, then working on it together. `page.tsx` renders one beat per entry and
 * alternates its background by index; `/features/<id>` renders each one's cards.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'spaces',
    label: 'Spaces',
    scene: 'space',
    cta: 'Explore Spaces',
    title: 'Walk in and meet in a Space',
    description:
      'Walk into a Space as your own little character, find the team round the table, and talk it through: status above your head, a speech bubble for a quick hello, a cheer when it goes well.',
    metaDescription:
      'Walk into a Space as your own character: offices, team pods and halls to meet in, with status, speech bubbles and reactions for the whole room.',
    highlights: [
      'Walk in as yourself',
      'Four Spaces to start from',
      'Status at a glance',
      'Say it in a bubble',
    ],
    items: [
      {
        art: <AvatarModeArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Walk in',
        title: 'Walk in as yourself',
        description:
          'Pick Avatar and a little pixel character stands on the board in your colour. Click or tap where you want to go and it walks there, steer it with the arrow keys, and press Space to hop and wave a flag. The board stays as it is while you walk, so nobody moves a sticky by accident.',
      },
      {
        art: <PresenceArt />,
        href: '/help/selection-modes/avatar-mode/avatar-tour/',
        group: 'Walk in',
        title: 'A character of your own',
        description:
          'Choose a gender, one of sixteen outfits, fourteen hairstyles and three sizes, or press randomise. Your browser remembers the character for next time, and your shirt is always your presence colour, so everyone can tell at a glance who is who.',
      },
      {
        art: <TemplatesArt />,
        href: '/help/palette/virtual-office/',
        group: 'Rooms to meet in',
        title: 'Four Spaces to start from',
        description:
          'Open a Virtual Office of rooms either side of a corridor, a Coworking Space with phone booths, a Team Pod with a meeting table and a board for the week, or an All-Hands Hall of chairs facing a stage. Each is ready to walk into, with no floor plan to draw first.',
      },
      {
        art: <BringFocusArt />,
        href: '/help/palette/avatar-pads/',
        group: 'Rooms to meet in',
        title: 'Spaces that open walking',
        description:
          'Open a Space and you are already on your feet: the board puts you in Avatar mode, standing on its Avatar Pad and arriving in a beam of light. Press Walk In to come back after you leave, or pick any other tool and carry on as you were.',
      },
      {
        art: <ComponentsArt />,
        href: '/help/palette/chairs/',
        group: 'Rooms to meet in',
        title: 'Desks, sofas and a coffee machine',
        description:
          'Build your own rooms from walls with doorways, desks, chairs, sofas, a meeting table, rugs, plants and bookshelves. Walk onto a chair to sit down, and walk up to the water cooler or the coffee machine to come away holding a drink.',
      },
      {
        art: <TabsArt />,
        href: '/help/palette/tools/portals/',
        group: 'Rooms to meet in',
        title: 'Fences and portals',
        description:
          'Fences and room walls keep characters where they belong, and they come in by the doorway. Step into a portal and you come out of its partner, on this tab or another, so a Space can run to several floors.',
      },
      {
        art: <PresenceArt />,
        href: '/help/selection-modes/walking-together/',
        group: 'Say hello',
        title: 'Everyone walks together',
        description:
          'On a shared Space every character is on everyone else’s board, in its owner’s colour with their name above its head. Click a teammate’s character to walk over and give them a gentle push. Viewers can walk too: walking changes nothing on the board.',
      },
      {
        art: <SelectionGlowArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Say hello',
        title: 'Status at a glance',
        description:
          'Say how you are without a word: Available, Focusing (headphones on), In a Meeting or Away, shown above your head while you walk. It lasts for the session only, so yesterday’s In a Meeting never greets anyone today.',
      },
      {
        art: <CommentsArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Say hello',
        title: 'Say it in a bubble',
        description:
          'Press Enter, type a line and it appears in a speech bubble over your character for everyone on the tab, then floats up and away. A hello, a follow me or a nice one while someone presents, with no chat panel and nothing left behind.',
      },
      {
        art: <AvatarModeArt />,
        href: '/help/palette/behaviour/reaction-pads/',
        group: 'Say hello',
        title: 'Wave, cheer and dance',
        description:
          'Five moves, each one key: jumping jacks, a wave, a spin, a cheer and a dance, and five bursts of confetti, sparkles, hearts, applause or fireworks. Reaction pads on the board throw them over the whole room when someone presses one or walks onto it.',
      },
      {
        art: <FollowAlongArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Say hello',
        title: 'A camera that keeps up',
        description:
          'Walk towards the edge of the screen and the board pans to keep you in view, never zooming, so you can cross a whole office without letting go of the arrow keys.',
      },
    ],
  },
  {
    id: 'workshops',
    label: 'Meetings',
    scene: 'townhall',
    cta: 'Explore meetings',
    title: 'Run the meeting from the room',
    description:
      'What a meeting needs is in the room: a timer everyone sees, a quick vote on the notes, a baton so one person runs it, and a way to ask everyone to look at the same thing.',
    metaDescription:
      'Run stand-ups and all-hands in a Space: a shared timer, a quick dot vote, a facilitator baton, Bring Focus, the laser and the spotlight.',
    highlights: [
      'Timer and vote',
      'One person runs the room',
      'Ask the room to look here',
      'A Space for every meeting',
    ],
    items: [
      {
        art: <SessionToolsArt />,
        href: '/help/collaboration/session-tools/',
        group: 'Run the room',
        title: 'Timer and vote',
        description:
          'Timer and Vote sit in the Session strip at the foot of every board. Start a countdown the whole room sees, or open a dot vote with a budget of dots on the notes in a room. Results tally live, and revealing a vote walks the room through the top picks one at a time.',
      },
      {
        art: <FacilitatorArt />,
        href: '/help/collaboration/facilitator/',
        group: 'Run the room',
        title: 'One person runs the room',
        description:
          'Hand someone the facilitator baton and the tools that run the meeting answer to them alone: the timer and the votes. No two people starting timers over each other. Nobody holds it by default, anybody can be given it, and the owner can always take it back.',
      },
      {
        art: <BringFocusArt />,
        href: '/help/palette/behaviour/bring-focus/',
        group: 'Run the room',
        title: 'Ask the room to look here',
        description:
          'Drop a Bring Focus element, press it, and everyone else is offered a jump to it: your tab, the thing you mean, centred on their screen. It asks rather than drags, so nobody loses the place they were working in.',
      },
      {
        art: <SpotlightArt />,
        href: '/help/selection-modes/spotlight/',
        group: 'Run the room',
        title: 'Spotlight the room on one thing',
        description:
          'Switch on Spotlight and the board dims under a soft shroud, with only a circle of light around your cursor. Walk the room through a busy board one piece at a time, and nobody else’s view is touched.',
      },
      {
        art: <LaserArt />,
        href: '/help/selection-modes/laser/',
        group: 'Run the room',
        title: 'A laser pointer everyone sees',
        description:
          'Switch to the laser and your cursor leaves a glowing trail on everyone’s screen. Point at the thing you mean while you talk it through, and the trail fades on its own.',
      },
      {
        art: <TemplatesArt />,
        href: '/help/canvas/templates/',
        group: 'Run the room',
        title: 'A Space for every meeting',
        description:
          'Start from a Team Pod for the stand-up, an All-Hands Hall with a stage, a Coworking Space to work side by side or a whole Virtual Office, or from a blank Space you furnish yourself.',
      },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaborate',
    scene: 'draw',
    cta: 'Explore collaboration',
    title: 'Work on it together, live',
    description:
      'Share a link and your team is in the Space with you: live cursors, comments on any element, actions handed to teammates, and links for whoever runs it, whoever takes part and whoever watches.',
    metaDescription:
      'Share a link and your team is in the Space with you: live cursors, comments, assigned actions, and share links for editors, participants and viewers.',
    highlights: [
      'Live presence',
      'Comments on any element',
      'Editor, participant or view-only links',
      'Assign actions to teammates',
    ],
    items: [
      {
        art: <PresenceArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'Live presence',
        description:
          'See who is in the Space from the participant avatars on each tab. Status rings show online, away or stale.',
      },
      {
        art: <RealtimeArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'Edits land live',
        description:
          'The moment someone makes a change, everyone sees it. If two people edit the same thing at once, the most recent change is the one that sticks.',
      },
      {
        art: <SelectionGlowArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'See what others are working on',
        description:
          'Click an element and your collaborators see your colour glow on its border, plus your initials in the corner, in real time.',
      },
      {
        art: <CommentsArt />,
        href: '/help/collaboration/comments/',
        group: 'Work together live',
        title: 'Comments on any element',
        description:
          "Right-click an element, leave a thread, and mention a teammate to let them know. Replies, emoji reactions, resolve, delete. Comments carry the author's name and colour so it's clear who said what.",
      },
      {
        art: <AssignedActionsArt />,
        href: '/help/collaboration/assigned-actions/',
        group: 'Work together live',
        title: 'Assign actions to teammates',
        description:
          'Turn any element into a piece of work: name the action, describe it, and hand it to a teammate from any of your teams, with an optional email nudge. An Actions panel tracks everything still open, with your own assignments on top.',
      },
      {
        art: <FollowAlongArt />,
        href: '/help/canvas/follow-along/',
        group: 'Work together live',
        title: 'Follow someone’s view',
        description:
          'Press Follow beside a teammate and your board goes where theirs goes: their tab, their pan, their exact zoom. The moment you move the board yourself, you have your own view back.',
      },
      {
        art: <TimelineFeedArt />,
        href: '/help/explorer/timeline/',
        group: 'Work together live',
        title: 'See what happened while you were away',
        description:
          'The Explorer opens on Home: the Spaces you return to most, and what your teammates commented, edited and assigned you while you were away. The Timeline holds the full feed.',
      },
      {
        art: <UndoRedoArt />,
        href: '/help/canvas/undo/',
        group: 'Work together live',
        title: 'Undo and redo',
        description:
          "Back out a recent edit with Cmd-Z, or bring it back with Cmd-Shift-Z. A whole drag is one step, and your undo rewinds your own edits, not a teammate's.",
      },
      {
        art: <ShareLinksArt />,
        href: '/help/collaboration/sharing/',
        group: 'Share & access',
        title: 'Editor, participant or view-only links',
        description:
          'Create an editor link for whoever runs the session, a participant link for a room that should add stickies, write and vote without reshaping the board, or a view-only link for people who should watch and walk, not touch. Point one at a single tab to keep the rest private.',
      },
      {
        art: <TeamsArt />,
        href: '/help/collaboration/teams/',
        group: 'Share & access',
        title: 'Teams with a shared library',
        description:
          'Create a team, invite people by email, and everyone gets a shared folder of Spaces they can all open and edit. Sign in to set one up; the Space itself never needs an account.',
      },
      {
        art: <ExpiryArt />,
        href: '/help/collaboration/sharing/share-link-expiry/',
        group: 'Share & access',
        title: 'Links that expire on their own',
        description:
          'Give a share link a lifetime when you create it: a week, a month, six months, or never. When it lapses the URL stops working on its own, and a password keeps a link for the people you told.',
      },
      {
        art: <RevokeArt />,
        href: '/help/privacy-and-security/share-link-security/',
        group: 'Share & access',
        title: 'Stop sharing on demand',
        description:
          'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The Space is yours again.',
      },
      {
        art: <LockArt />,
        href: '/help/privacy-and-security/offline-mode/',
        group: 'Your Spaces, your way',
        title: 'Keep a Space in This Browser',
        description:
          'Without an account your Spaces live in This Browser and never leave it. Take a Space offline whenever you like, or sync it to your account when you want company.',
      },
      {
        art: <ExportArt />,
        href: '/help/account-and-data/google-drive/',
        group: 'Your Spaces, your way',
        title: 'A copy in your Google Drive',
        description:
          'Signed in, connect Google Drive and every Space you own is kept as a file in your own Drive, in folders that match yours, synced both ways.',
      },
      {
        art: <LiveImageArt />,
        href: '/help/collaboration/sharing/community/',
        group: 'Your Spaces, your way',
        title: 'Share a Space with the Community',
        description:
          'Publish a Space you are proud of to the Community gallery, filed under meetings and workshops, so another team can start their next session from yours.',
      },
      {
        art: <McpArt />,
        href: '/help/account-and-data/connect-ai-mcp/',
        group: 'Your Spaces, your way',
        title: 'Bring your AI tools',
        description:
          'Hook livehuddle up to Claude or any MCP client at mcp.livehuddle.app and let it find, read, create, change and share your Spaces for you: set out an agenda, fill a retro from your notes. It runs on a revocable token, read-only if you prefer.',
      },
      {
        art: <ApiArt />,
        href: '/help/developers/cli/',
        group: 'Your Spaces, your way',
        title: 'A command line and an API',
        description:
          'Install the livehuddle command line from npm, or call the same REST API the editor uses with an API token, to read, change, share and export your Spaces from your own scripts.',
      },
    ],
  },
];

/**
 * The section ids, in render order. The `/features/<id>` detail route's
 * `generateStaticParams` and the sitemap both map over this, so adding a
 * section to `LANDING_SECTIONS` automatically gives it a page + a sitemap
 * entry with no second list to keep in sync.
 */
export const LANDING_SECTION_IDS = LANDING_SECTIONS.map((section) => section.id);

/** Look up a single section by id (the `/features/<id>` page's source). */
export function getLandingSection(id: string): LandingSection | undefined {
  return LANDING_SECTIONS.find((section) => section.id === id);
}

type FeatureGroup = { title: string; items: FeatureProps[] };

/**
 * Split a section's features into ordered, captioned sub-groups for the
 * detail page. Groups appear in first-seen order; items keep their order
 * within a group. Returns `null` when the section has no `group` tags at all,
 * so the caller renders one flat grid (only the larger categories opt in to
 * grouping; see the `group` field on `FeatureProps`).
 */
export function groupSectionFeatures(section: LandingSection): FeatureGroup[] | null {
  if (!section.items.some((item) => item.group)) return null;
  const order: string[] = [];
  const byGroup = new Map<string, FeatureProps[]>();
  for (const item of section.items) {
    const key = item.group ?? 'More';
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      order.push(key);
    }
    byGroup.get(key)!.push(item);
  }
  return order.map((title) => ({ title, items: byGroup.get(title)! }));
}

/** The features a section's beat lists, in order. Throws on a title no item has (a test pins them). */
export function sectionHighlights(section: LandingSection): FeatureProps[] {
  return section.highlights.map((title) => {
    const item = section.items.find((i) => i.title === title);
    if (!item) throw new Error(`Section "${section.id}" highlights unknown feature "${title}"`);
    return item;
  });
}
