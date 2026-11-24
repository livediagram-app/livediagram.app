// The Collaborate category of the landing page and /features/collaboration, kept apart from
// ./landing-content (which lists it last) so neither file grows past the repo's size cap.
import {
  ApiArt,
  ApprovalArt,
  AskAiArt,
  CallArt,
  LiveDataArt,
  SendToPlanArt,
  ViewAsDiagramArt,
  CalendarFeedArt,
  CollaboratorsArt,
  CommentsArt,
  ConnectedFilesArt,
  DescribePlanArt,
  DriveCopyArt,
  EmbedBoardArt,
  ExpiryArt,
  McpArt,
  OfflineSaveArt,
  PresenceArt,
  RealtimeArt,
  RevokeArt,
  SelectionGlowArt,
  SessionToolsArt,
  ShareLinksArt,
  SharePasswordArt,
  SnapshotsArt,
  TeamsArt,
  WalkthroughArt,
} from '@/components/FeatureArt';
import type { LandingSection } from './landing-section';

export const COLLABORATION_SECTION: LandingSection = {
  id: 'collaboration',
  label: 'Collaborate',
  scene: 'together',
  cta: 'Explore collaboration',
  title: 'Plan it together, live',
  description:
    'Share a link and your team is in the plan with you: live presence on every board, sheet and dashboard, comments on cards and cells, a call started from the plan, cards sent in from your other apps, and Ask AI to answer from the plan itself.',
  metaDescription:
    'Share a link and your team plans with you live: presence on every tab, comments on cards and cells, share links with the right access, and agent access.',
  highlights: [
    'Comments where the work is',
    'Start a call from the plan',
    'Cards from anywhere',
    'Ask the plan a question',
  ],
  items: [
    {
      art: <PresenceArt />,
      href: '/help/collaboration/live-presence/',
      group: 'Work together live',
      title: 'Live presence',
      description:
        'See who is in the plan from the avatars on each tab. Status rings show online, away, or stale.',
    },
    {
      art: <RealtimeArt />,
      href: '/help/collaboration/live-presence/',
      group: 'Work together live',
      title: 'Edits land live',
      description:
        'The moment someone moves a card or changes a cell, everyone sees it. If two people edit the same thing at once, the most recent change is the one that sticks.',
    },
    {
      art: <SelectionGlowArt />,
      href: '/help/collaboration/live-presence/',
      group: 'Work together live',
      title: 'See what others are working on',
      description:
        'Select a card or a cell and your collaborators see your colour around it, with your name beside it, in real time.',
    },
    {
      art: <CommentsArt />,
      href: '/help/collaboration/comments/',
      group: 'Work together live',
      title: 'Comments where the work is',
      description:
        "Every card has its own thread, and any cell can carry one. Reply, @mention a teammate, resolve. Comments carry the author's name and colour so it's clear who said what.",
    },
    {
      art: <CollaboratorsArt />,
      href: '/help/collaboration/live-presence/#collaborators',
      group: 'Work together live',
      title: 'See where the whole room is',
      description:
        'Click any avatar on a tab and Collaborators lists everyone in the plan by the tab they are on, with their role, whether they are online or away, and when they were last active. Go to Tab takes you straight to them.',
    },
    {
      art: <SessionToolsArt />,
      href: '/help/collaboration/session-tools/',
      group: 'Work together live',
      title: 'Run the session in the plan',
      description:
        'Time-box a retro with a countdown everyone sees ticking in sync, then dot-vote on the cards with live tallies and a results reveal. Join late or reload and the clock and the votes are right where the room left them.',
    },
    {
      art: <WalkthroughArt />,
      href: '/help/collaboration/walkthroughs/',
      group: 'Work together live',
      title: 'Walk them through it',
      description:
        'Record a walkthrough: your voice, your camera in a round bubble if you like, and every tab you open. Teammates play it back over the plan itself, so they can pause, look around and carry on. Hide private cards from the recording first.',
    },
    {
      art: <SnapshotsArt />,
      href: '/help/collaboration/snapshots/',
      group: 'Work together live',
      title: 'Snapshots before a big change',
      description:
        'Take a snapshot of the whole plan before a reorganisation, an import or a clean-up with an agent. The latest five are kept, and Revert puts every tab, card and Sheet back as it was in one step.',
    },
    {
      art: <OfflineSaveArt />,
      href: '/help/troubleshooting/missing-changes/',
      group: 'Work together live',
      title: 'Keep going when the wifi drops',
      description:
        'Lose the connection and keep moving cards and filling in cells: each change waits in this browser and saves when you reconnect. And a burst of removals that would clear a board is held until you choose Keep Cards or remove them.',
    },
    {
      art: <CallArt />,
      href: '/help/collaboration/start-a-call/',
      group: 'Work together live',
      title: 'Start a call from the plan',
      description:
        'Signed in, press Call and a livehuddle video call about the plan opens in a new tab. Everyone who opens the plan sees it is on, with how many are in it and Join, and the call’s summary and actions can land back where they belong.',
    },
    {
      art: <ApprovalArt />,
      href: '/help/collaboration/sharing/request-approval/',
      group: 'Work together live',
      title: 'Ask for sign-off',
      description:
        'Request Approval from the people you name, with a note and a due day. Each answers Approve or Request Changes, and the plan’s badge says where it stands, down to Changed Since Approval once someone edits it after.',
    },
    {
      art: <AskAiArt />,
      group: 'Work together live',
      title: 'Ask the plan a question',
      description:
        'Signed in, open Ask AI in Tools and ask “what is in progress right now?” or “which cards have no description?”. The answer comes from the plan’s own cards and tabs, with each source a card you can open.',
    },
    {
      art: <ShareLinksArt />,
      href: '/help/collaboration/sharing/',
      group: 'Share & access',
      title: 'Editor, participant or view-only links',
      description:
        'Create an editor link for collaborators, a participant link for people who should add cards and fill in cells without changing the setup, or a view-only link for stakeholders who should watch, not touch. Run as many links as you like, side by side, and point one at a single tab to keep the rest of the plan private.',
    },
    {
      art: <TeamsArt />,
      href: '/help/collaboration/teams/',
      group: 'Share & access',
      title: 'Teams with a shared library',
      description:
        'Create a team, invite people by email, and everyone gets a shared folder of plans they can all open and edit. Admins manage membership and roles; members just get to work. Sign in to set one up, a plan itself never needs an account.',
    },
    {
      art: <ExpiryArt />,
      href: '/help/collaboration/sharing/share-link-expiry/',
      group: 'Share & access',
      title: 'Links that expire on their own',
      description:
        'Give a share link a lifetime when you create it: a week, a month, six months, or never. When it lapses the URL stops working on its own, no cleanup to remember, and you can extend it for another run or delete it for good.',
    },
    {
      art: <RevokeArt />,
      href: '/help/collaboration/sharing/',
      group: 'Share & access',
      title: 'Stop sharing on demand',
      description:
        'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The plan is yours again.',
    },
    {
      art: <EmbedBoardArt />,
      href: '/help/collaboration/sharing/embeds/',
      group: 'Share & access',
      title: 'Embed a live board',
      description:
        'Paste an embed from a share link into a wiki, a doc or your own site and the board, sheet, dashboard or form shows there, kept live. A view-only link embeds it read-only; an editor link lets readers move cards right there.',
    },
    {
      art: <SharePasswordArt />,
      href: '/help/collaboration/sharing/share-passwords/',
      group: 'Share & access',
      title: 'A password on the plan',
      description:
        'Add a password and anyone arriving by a share link, or an embed, must enter it before the plan opens. You and your team never need it, and Remove takes it off again.',
    },
    {
      art: <McpArt />,
      href: '/help/account-and-data/connect-ai-mcp/',
      group: 'Agents & your tools',
      title: 'Agents that work beside you',
      description:
        'Connect Claude, ChatGPT or another AI tool over MCP and it can read your boards, cards, sheets and forms, and change them the way you would: add cards, move them across columns, fill in cells, build a form, set up an automation rule. Assign it a card and it finds the card, works it and hands it back to you. Every change it makes lands live, like a teammate’s.',
    },
    {
      art: <ApiArt />,
      href: '/help/developers/api-overview/',
      group: 'Agents & your tools',
      title: 'An API and a CLI',
      description:
        'The same plan, cards and sheets over a plain HTTP API with personal tokens, and a command-line tool for scripts and agents that live in a terminal.',
    },
    {
      art: <DescribePlanArt />,
      href: '/help/plan/describe-a-plan/',
      group: 'Agents & your tools',
      title: 'Describe it, get the board',
      description:
        'When your work runs its own way, sign in and say it in your own words: a hiring pipeline with Applied, Screen, Interview and Offer, say. AI drafts the columns, the card types with their fields and a starter rule or two, for you to check and change before Make Plan makes anything.',
    },
    {
      art: <CalendarFeedArt />,
      href: '/help/plan/calendar-feed/',
      group: 'Beyond the plan',
      title: 'Dates in your calendar',
      description:
        'Signed in, Subscribe to Calendar puts the plan’s card dates in Google Calendar, Outlook or Apple Calendar from a private link, kept up to date: one board or all, only your cards if you like. Reset Link stops the old one at once.',
    },
    {
      art: <ConnectedFilesArt />,
      href: '/help/tabs/connected-files/',
      group: 'Beyond the plan',
      title: 'Files from your other apps',
      description:
        'Connect a file from any liveworkspace app as a tab beside your boards and sheets, so the brief, the screens and the architecture behind the plan are one tap away, each with a preview and a way in. Signed in, Start a Project makes a plan and its files in the other apps at once, already connected.',
    },
    {
      art: <DriveCopyArt />,
      href: '/help/account-and-data/google-drive/',
      group: 'Beyond the plan',
      title: 'A copy in your Google Drive',
      description:
        'Signed in, connect Google Drive and every plan you own is kept as a file in your own Drive, in folders that match yours. Renames, moves and deletions sync both ways.',
    },
    {
      art: <SendToPlanArt />,
      href: '/help/collaboration/send-to-plan/',
      group: 'Beyond the plan',
      title: 'Cards from anywhere',
      description:
        'Spot a task in another app, a sticky in livediagram, a paragraph in livedocuments, a page’s thread in liveknowledge or an action from a livehuddle call, and Send to Plan makes it a card on your board. The card links back to where it came from, and that place shows the card’s status, live.',
    },
    {
      art: <ViewAsDiagramArt />,
      href: '/help/collaboration/view-as-diagram/',
      group: 'Beyond the plan',
      title: 'See how the work hangs together',
      description:
        'View As Diagram draws a board in livediagram, beside the plan as a connected tab: cards as boxes in lanes by column, Blocked By links as arrows and the critical path highlighted, redrawn as the plan changes. And Make Plan Cards in livediagram turns a sketched flow into cards.',
    },
    {
      art: <LiveDataArt />,
      href: '/help/plan/sheets/',
      group: 'Beyond the plan',
      title: 'Live numbers in your reports',
      description:
        'Charts and tables in livedocuments, livediagram, livedesign and liveknowledge can take their numbers from the plan: a range of a Sheet, a board’s cards counted by column, label, person or priority, or a Dashboard figure. They keep in step as the cards move.',
    },
  ],
};
