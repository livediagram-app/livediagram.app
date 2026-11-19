import type { HeroSceneKey } from '@/components/hero-scenes';
import {
  ApiArt,
  AttendanceArt,
  ArriveArt,
  BringFocusArt,
  BrowserSpaceArt,
  BubbleArt,
  CameraBubbleArt,
  CameraArt,
  CharacterArt,
  CommunitySpaceArt,
  DirectoryArt,
  DoNotDisturbArt,
  DriveCopyArt,
  EveryMeetingArt,
  EveryoneArt,
  ExpiryArt,
  FacilitatorArt,
  FollowArt,
  FourSpacesArt,
  FurnitureArt,
  GamesArt,
  KnockArt,
  MiniViewArt,
  NoteUndoArt,
  PortalArt,
  PresenceArt,
  PrivateRoomArt,
  ReactArt,
  RealtimeArt,
  ReceptionistArt,
  RevokeArt,
  RoomBuilderArt,
  ScreenShareArt,
  SelectedNoteArt,
  SessionToolsArt,
  ShareLinksArt,
  SnapshotsArt,
  Space3DArt,
  StageArt,
  StatusArt,
  TalkNearArt,
  TeamsArt,
  WalkInArt,
  WebhooksArt,
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
 * meeting you hold in it, then being in it together. `page.tsx` renders one beat per entry and
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
      'Walk into a Space as your own little character and see it stand up around you in 3D. Find the team round the table and talk it through: status above your head, a speech bubble for a quick hello, a cheer when it goes well.',
    metaDescription:
      'Walk into a Space as your own character and see it in 3D: thirty-two offices, campuses, halls and homes to meet in, with status, bubbles and reactions.',
    highlights: [
      'Walk in as yourself',
      'See the Space in 3D',
      'Thirty-two Spaces to start from',
      'Status at a glance',
    ],
    items: [
      {
        art: <WalkInArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Walk in',
        title: 'Walk in as yourself',
        description:
          'Pick Avatar and a little pixel character stands on the board in your colour. Click or tap where you want to go and it walks there, steer it with the arrow keys, and press Space to hop and wave a flag. The board stays as it is while you walk, so nobody moves a sticky by accident.',
      },
      {
        art: <Space3DArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Walk in',
        title: 'See the Space in 3D',
        description:
          'Walk a Space and it tilts back like a map: walls stand up with framed doorways and windows, characters stand upright, and the walls in front of you fade so you can see into a room before you go in. The 3D View is on from the start, and one press of the 3D View switch lays the Space flat again.',
      },
      {
        art: <CharacterArt />,
        href: '/help/selection-modes/avatar-mode/avatar-tour/',
        group: 'Walk in',
        title: 'A character of your own',
        description:
          'Choose a gender, one of sixteen outfits, fourteen hairstyles and three sizes, or press randomise. Your browser remembers the character for next time, and your shirt is always your presence colour, so everyone can tell at a glance who is who.',
      },
      {
        art: <FourSpacesArt />,
        href: '/help/palette/virtual-office/',
        group: 'Rooms to meet in',
        title: 'Thirty-two Spaces to start from',
        description:
          'Open a Virtual Office of rooms either side of a corridor, a Team Pod with a board for the week, an All-Hands Hall facing a stage, a whole Company Campus, a house with stairs between its floors, a games room, a Festival Field or an Art Gallery. Each has an Avatar Pad to arrive on and is ready to walk into, with no floor plan to draw first.',
      },
      {
        art: <ArriveArt />,
        href: '/help/palette/avatar-pads/',
        group: 'Rooms to meet in',
        title: 'Spaces that open walking',
        description:
          'Open a Space and you are already on your feet: the board puts you in Avatar mode, standing on its Avatar Pad and arriving in a beam of light. Press Walk to come back after you leave, or pick any other tool and carry on as you were.',
      },
      {
        art: <FurnitureArt />,
        href: '/help/palette/chairs/',
        group: 'Rooms to meet in',
        title: 'Desks, sofas and a coffee machine',
        description:
          'Furnish it with desks, chairs, sofas, a meeting table, rugs, plants, a kitchenette and an office dog. Walk onto a chair to sit down, walk up to the coffee machine to come away holding a drink, lie back in the Nap Pod to show Focusing, or step into the Phone Booth to show Busy.',
      },
      {
        art: <RoomBuilderArt />,
        href: '/help/palette/virtual-office/',
        group: 'Rooms to meet in',
        title: 'Draw any room',
        description:
          'Click the corners of an L-shaped open plan with the Room Builder, join rooms with Corridors, and snap a Door, a Double Door, a Sliding Door or a Window onto any wall. Give a room glass walls so everyone sees who is in, while its call stays private.',
      },
      {
        art: <ReceptionistArt />,
        href: '/help/selection-modes/avatar-mode/avatar-tour/',
        group: 'Rooms to meet in',
        title: 'A host at the door',
        description:
          'The Receptionist lives by the Avatar Pad and goes about his day until someone arrives, then walks over to welcome them. Ask him how anything works and he answers in a speech bubble, pointing at the real control. Ring the Reception Desk bell to call him over.',
      },
      {
        art: <GamesArt />,
        href: '/help/palette/virtual-office/',
        group: 'Rooms to meet in',
        title: 'Games to play together',
        description:
          'Sit at either end of the Ping-Pong Table for a real game for two, watched live by everyone on the tab. Fly Moon Mail on the Arcade Machine and post your best run to its High Scores, shared by the whole Space.',
      },
      {
        art: <PortalArt />,
        href: '/help/palette/tools/portals/',
        group: 'Rooms to meet in',
        title: 'Fences and portals',
        description:
          'Fences and room walls keep characters where they belong, and they come in by the doorway. Step into a portal and you come out of its partner, on this tab or another, so a Space can run to several floors.',
      },
      {
        art: <DirectoryArt />,
        href: '/help/palette/directory/',
        group: 'Rooms to meet in',
        title: 'Floors, lifts and a directory',
        description:
          'Each tab of a Space can be a floor. Take the Elevator to any floor or the Stairs one floor up or down, and check the Directory for every room in the building with who is in each, then Walk There or go straight in.',
      },
      {
        art: <EveryoneArt />,
        href: '/help/selection-modes/walking-together/',
        group: 'Say hello',
        title: 'Everyone walks together',
        description:
          'On a shared Space every character is on everyone else’s board, in its owner’s colour with their name above its head. Click a teammate’s character to walk over and give them a gentle push. Everyone can walk, whatever their role: walking changes nothing on the board.',
      },
      {
        art: <StatusArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Say hello',
        title: 'Status at a glance',
        description:
          'Say how you are without a word: Available, Focusing (headphones on), Out to Lunch, Angry (steam from the ears), Celebrating and more, shown on your character and above your head while you walk. It lasts for the session only, so yesterday’s In a Meeting never greets anyone today.',
      },
      {
        art: <BubbleArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Say hello',
        title: 'Say it in a bubble',
        description:
          'Press Enter, type a line and it appears in a speech bubble over your character for everyone on the tab, then floats up and away. A hello, a follow me or a nice one while someone presents, with no chat panel and nothing left behind.',
      },
      {
        art: <ReactArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Say hello',
        title: 'Wave, cheer and dance',
        description:
          'Five moves, each one key: jumping jacks, a wave, a spin, a cheer and a dance, and five bursts of confetti, sparkles, hearts, applause or fireworks.',
      },
      {
        art: <CameraArt />,
        href: '/help/selection-modes/avatar-mode/',
        group: 'Say hello',
        title: 'A camera that keeps up',
        description:
          'Walk towards the edge of the screen and the board pans to keep you in view, never zooming, so you can cross a whole office without letting go of the arrow keys.',
      },
    ],
  },
  {
    id: 'meetings',
    label: 'Meetings',
    scene: 'hall',
    cta: 'Explore meetings',
    title: 'Talk it through, right where you stand',
    description:
      'Walk up to someone and you are talking: voices fade as you walk apart, a room’s walls keep its call private, and a camera or a shared screen shows above your head. The rest of the meeting is in the room too: a timer, a stage and a baton for whoever runs it.',
    metaDescription:
      'Talk in a Space by walking up to people: private rooms, cameras and screens above your head, a stage for the all-hands, and a timer on the wall.',
    highlights: [
      'Talk to whoever is near you',
      'Rooms keep a call private',
      'Your camera, above your head',
      'Speak from the stage',
    ],
    items: [
      {
        art: <TalkNearArt />,
        href: '/help/collaboration/proximity-audio/',
        group: 'Talk',
        title: 'Talk to whoever is near you',
        description:
          'There is nothing to join: walk up to people and you hear each other, louder the closer you stand and fading as you walk away, with voices to your left heard on your left. Someone talking further off shows it, so you can walk over. Your microphone starts muted.',
      },
      {
        art: <PrivateRoomArt />,
        href: '/help/collaboration/proximity-audio/#rooms-are-private',
        group: 'Talk',
        title: 'Rooms keep a call private',
        description:
          'Step into a room and its walls keep the conversation in: nobody outside hears a word, however close they stand to the door, and two rooms side by side never hear each other. A phone booth inside an open-plan room is a quiet corner of its own.',
      },
      {
        art: <CameraBubbleArt />,
        href: '/help/collaboration/cameras-and-screen-sharing/',
        group: 'Talk',
        title: 'Your camera, above your head',
        description:
          'Turn on your camera and it shows as a bubble just above your character, to the people who can hear you and nobody else. Press any bubble to see it large. Walk away and it goes; walk back and it returns.',
      },
      {
        art: <ScreenShareArt />,
        href: '/help/collaboration/cameras-and-screen-sharing/',
        group: 'Talk',
        title: 'Share your screen',
        description:
          'Editors can share a screen, a window or a browser tab, and it shows over your head to the people near you, tuned so text reads clearly. In Chrome and Edge you stay on the Space as you share, so you never lose sight of the room. Put a Screen on a meeting room’s wall and a share there plays on it for everyone inside.',
      },
      {
        art: <StageArt />,
        href: '/help/palette/virtual-office/stage/',
        group: 'Talk',
        title: 'Speak from the stage',
        description:
          'Walk onto a Stage and the whole Space hears you, in any room or none, while the audience whisper to their neighbours unheard. Stand at a Podium and your voice carries three times as far. Raise Hand asks to speak, and whoever is on the stage can let you.',
      },
      {
        art: <MiniViewArt />,
        href: '/help/collaboration/proximity-audio/',
        group: 'Talk',
        title: 'Keep the Space in view',
        description:
          'In Chrome and Edge, press Pop Out and the Mini View stays on top while you work in another tab: who is near you, who is talking, raised hands, knocks with Let In and Not Now, your microphone and camera, and up to four camera tiles.',
      },
      {
        art: <DoNotDisturbArt />,
        href: '/help/collaboration/proximity-audio/#do-not-disturb',
        group: 'Talk',
        title: 'Quiet when you need it',
        description:
          'Set Do Not Disturb and no voice, camera or screen reaches you, and knocks and chimes stay quiet, while you can still speak to a neighbour. When you do want someone, Nudge them from Collaborators and their screen chimes with a way to find you.',
      },
      {
        art: <KnockArt />,
        href: '/help/palette/room-sign/',
        group: 'Run the room',
        title: 'Knock before you walk in',
        description:
          'A Room Sign by the door says whether a room is Free or In Use, with how many inside and for how long. Press Knock and the people inside see who is asking, with Let In and Not Now.',
      },
      {
        art: <SessionToolsArt />,
        href: '/help/collaboration/session-tools/timer/',
        group: 'Run the room',
        title: 'Timer and Stopwatch',
        description:
          'Place a Timer or a Stopwatch in any room. Start a countdown the whole room sees, or run a stopwatch, and pause or restart it for everyone at once, with a gentle chime at zero.',
      },
      {
        art: <FacilitatorArt />,
        href: '/help/collaboration/facilitator/',
        group: 'Run the room',
        title: 'One person runs the room',
        description:
          'Hand someone the facilitator baton and the tools that run the meeting answer to them alone, starting with the timer. No two people starting timers over each other. Nobody holds it by default, anybody can be given it, and the owner can always take it back.',
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
        art: <EveryMeetingArt />,
        href: '/help/canvas/templates/',
        group: 'Run the room',
        title: 'A Space for every meeting',
        description:
          'Start from a Team Pod for the stand-up, an Interview Suite or a Client Lounge for people from outside, a Classroom or a Hackathon Hall, an All-Hands Hall with a stage, a Conference Venue for the big day, or a blank Space you furnish yourself.',
      },
      {
        art: <AttendanceArt />,
        href: '/help/collaboration/live-presence/tab-attendance/',
        group: 'Run the room',
        title: 'Who came, and for how long',
        description:
          'Open a tab’s Attendance after the stand-up to see who came in, when they joined and left, and how long they stayed, kept for 90 days. A dropped connection or a quick reload is never counted as leaving.',
      },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaborate',
    scene: 'office',
    cta: 'Explore collaboration',
    title: 'Together in one place, live',
    description:
      'Share a link and your team is in the Space with you: who is where at a glance, sticky notes on the walls, and links for whoever runs it, whoever takes part and whoever watches.',
    metaDescription:
      'Share a link and your team is in the Space with you: live presence, a call, sticky notes on the walls, and share links for editors and participants.',
    highlights: [
      'Live presence',
      'Follow someone’s view',
      'Editor and participant links',
      'Teams with a shared library',
    ],
    items: [
      {
        art: <PresenceArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'Live presence',
        description:
          'See who is in the Space from the participant avatars on each tab, with status rings for online, away or offline. A soft chime says when someone arrives or leaves, and arrows at the edge of the screen point to anyone out of view.',
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
        art: <SelectedNoteArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'See what others are working on',
        description:
          'Click an element and your collaborators see your colour glow on its border, plus your initials in the corner, in real time.',
      },
      {
        art: <FollowArt />,
        href: '/help/canvas/follow-along/',
        group: 'Work together live',
        title: 'Follow someone’s view',
        description:
          'Press Follow beside a teammate and your board goes where theirs goes: their tab, their pan, their exact zoom. The moment you move the board yourself, you have your own view back.',
      },
      {
        art: <NoteUndoArt />,
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
        title: 'Editor and participant links',
        description:
          'Create an editor link for whoever runs the session, or a participant link, the default, for a room that should talk, add stickies, write and comment without reshaping the board. Point one at a single tab to keep the rest private.',
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
        art: <BrowserSpaceArt />,
        href: '/help/privacy-and-security/offline-mode/',
        group: 'Your Spaces, your way',
        title: 'Keep a Space in This Browser',
        description:
          'Without an account your Spaces live in This Browser and never leave it. Take a Space offline whenever you like, or sync it to your account when you want company.',
      },
      {
        art: <DriveCopyArt />,
        href: '/help/account-and-data/google-drive/',
        group: 'Your Spaces, your way',
        title: 'A copy in your Google Drive',
        description:
          'Signed in, connect Google Drive and every Space you own is kept as a file in your own Drive, in folders that match yours, synced both ways.',
      },
      {
        art: <CommunitySpaceArt />,
        href: '/help/collaboration/sharing/community/',
        group: 'Your Spaces, your way',
        title: 'Share a Space with the Community',
        description:
          'Publish a Space you are proud of to the Community gallery, filed under offices, meetings or socials, so another team can start their next meeting from yours.',
      },
      {
        art: <SnapshotsArt />,
        href: '/help/collaboration/snapshots/',
        group: 'Your Spaces, your way',
        title: 'Snapshots to go back to',
        description:
          'Before a big rearrange, press Take Snapshot in History. The latest five are kept, and Revert puts the whole Space back as it was in one step, taking a Before revert snapshot first in case you change your mind.',
      },
      {
        art: <WebhooksArt />,
        href: '/help/explorer/explorer-page/',
        group: 'Your Spaces, your way',
        title: 'Webhooks to Slack and Teams',
        description:
          'Signed in, add a webhook to a Space and it tells a Slack or Microsoft Teams channel, or any address as signed JSON, when it is renamed, moved, shared or sent to the Trash.',
      },
      {
        art: <ApiArt />,
        href: '/help/developers/api-overview/',
        group: 'Your Spaces, your way',
        title: 'An open API',
        description:
          'Call the same REST API the editor uses with an API token to read, change, share and export your Spaces from your own scripts.',
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
