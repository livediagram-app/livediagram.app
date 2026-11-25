// The merged articles of the collaboration batch (liveworkspace/docs/specs/017-help/help-centre.md): one entry per path,
// `apps` the apps whose help had the article, in registry order. Keywords are the union of the copies' keywords.

import type { Article } from '../../types';

export const articles: Article[] = [
  {
    slug: 'assigned-actions',
    title: 'Assigned Actions',
    description: 'Assign work on an element to a teammate and track it until done.',
    keywords: 'task assign todo work teammate track tickets delegate owner',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livediagram', 'livedocuments', 'livedesign'],
    byApp: { livediagram: { group: 'Working Together' } },
  },
  {
    slug: 'comments',
    title: 'Comments',
    description:
      'Leave threaded comments, react with an emoji, mention teammates and resolve them.',
    keywords:
      'thread feedback reply resolve discussion note annotate mention reaction reactions react emoji thumbs up like heart hooray eyes laugh threads comment and',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'liveknowledge'],
    byApp: { livediagram: { group: 'Working Together' } },
  },
  {
    slug: 'send-to-plan',
    title: 'Send to Plan',
    description:
      'Turn a sticky, a shape, some words or a thread into a card in one of your plans, linked back to the place.',
    keywords:
      'send to plan card liveplanner kanban board task todo action items follow up turn into card ticket track chip sent from checklist assignee due',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: { livediagram: { group: 'Other Apps' } },
  },
  {
    slug: 'send-to-knowledge-base',
    title: 'Send to Knowledge Base',
    description:
      'Pick part of a diagram, and AI writes it up on a liveknowledge page with a picture and a link back.',
    keywords:
      'send to knowledge base knowledgebase liveknowledge wiki page section summary summarise summarize document write up ai picture sent from chip handbook docs',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livediagram', 'liveknowledge'],
    byApp: { livediagram: { group: 'Other Apps' } },
  },
  {
    slug: 'suggestions',
    title: 'Suggestions',
    description:
      'A small offer, at the right moment, to take what you have open into another app in one click.',
    keywords:
      'suggestion suggestions suggest other apps next app offer prompt nudge hint make these a plan write it up add to knowledgebase bring in send to a plan dont suggest this again turn off',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livehuddle', 'liveknowledge'],
    byApp: { livediagram: { group: 'Other Apps' } },
  },
  {
    slug: 'start-a-call',
    title: 'Start a Call Here',
    description:
      'Start a livehuddle video call about what you have open, then send its summary and actions on.',
    keywords:
      'call video call meeting huddle talk join in call meetings invite wrap up summary minutes notes knowledgebase actions plan start a call here livehuddle zoom meet',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: { livediagram: { group: 'Other Apps' } },
  },
  {
    slug: 'facilitator',
    title: 'Facilitator',
    description: 'Give one person the tools that run a live session, and hand the role on.',
    keywords:
      'facilitator workshop host run the room session lead moderator driver baton timer vote poll control handover take over step down chair meeting',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livediagram', 'livehuddle'],
    byApp: { livediagram: { group: 'Running Sessions' } },
  },
  {
    slug: 'live-presence',
    title: 'Live Presence',
    description:
      'See who is here in real time: who is on which tab, what each person is working on, and agents at work.',
    keywords:
      'cursors online who viewing realtime collaborators avatars multiplayer people participants roster room agent agents ai status working focus sound chime join leave arrive nudge poke ping attention desktop notification',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: {
      livediagram: { group: 'Working Together' },
      liveknowledge: {
        description:
          'See who is here in real time: who is on which page, what each person is working on, and agents at work.',
      },
    },
  },
  {
    slug: 'session-tools',
    title: 'Session Tools',
    description:
      'A shared timer, and in some apps live dot-voting and polls, for running a live session.',
    keywords:
      'timer voting workshop meeting facilitation retro countdown poll polls survey pulse check stopwatch dots picker random temperature fist of five timebox clock room piece',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livediagram', 'liveplanner', 'livehuddle'],
    byApp: { livediagram: { group: 'Running Sessions' } },
  },
  {
    slug: 'timer',
    title: 'Timer and Stopwatch',
    description: 'Run a shared countdown or stopwatch that everyone sees tick in sync.',
    keywords:
      'countdown stopwatch timebox clock minutes workshop timer chime alarm meeting palette piece place room start pause reset',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
    apps: ['livediagram', 'liveplanner', 'livehuddle'],
  },
  {
    slug: 'voting',
    title: 'Dot Voting',
    description: 'Let everyone vote live, privately if you want, and tally the results.',
    keywords:
      'vote poll tally decide prioritise prioritize dots anonymous private privacy secret blind hide hidden cursors pointers counts totals dot',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
    apps: ['livediagram', 'liveplanner'],
  },
  {
    slug: 'casting-dots',
    title: 'Casting Dots',
    description: 'Spending and taking back your dots, and what counts as votable.',
    keywords:
      'cast dot dots vote counter tally pill plus minus retract withdraw budget spend stack votable shapes sticky notes images frames arrows not cards board',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
    apps: ['livediagram', 'liveplanner'],
  },
  {
    slug: 'vote-panel',
    title: 'The Vote Panel',
    description: 'Track how far through a vote the room has got.',
    keywords:
      'vote panel turnout progress dots cast finished waiting pips remaining left rows unnamed anonymous when to end',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
    apps: ['livediagram', 'liveplanner'],
  },
  {
    slug: 'vote-privacy',
    title: 'Private Voting',
    description: 'Hide cursors and hide the running counts for a blind vote.',
    keywords:
      'private privacy secret blind anonymous hide cursors pointers laser running counts totals tallies pile on bandwagon switches fixed',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
    apps: ['livediagram', 'liveplanner'],
  },
  {
    slug: 'vote-results',
    title: 'Vote Results',
    description: 'The shared walkthrough of what won, with the ranked list beside it.',
    keywords:
      'results reveal show winners ranked list top result walkthrough previous next done highlight amber follow shared focus clear vote',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
    apps: ['livediagram', 'liveplanner'],
  },
  {
    slug: 'sharing',
    title: 'Sharing and Embeds',
    description:
      'Share links at the access level you choose, passwords, expiry, embeds and live images.',
    keywords:
      'share link collaborate invite embed read only publish url send viewer participant editor create and copy turn off pass role legacy',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: { livediagram: { group: 'Working Together' } },
  },
  {
    slug: 'community',
    title: 'Sharing to the Community',
    description: 'Publish your work to the public gallery for others to view and copy.',
    keywords:
      'community gallery public publish showcase inspiration examples share document proud like likes copy copies tags category report moderation discover browse canvas explorer from plan design portfolio',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'embeds',
    title: 'Embeds',
    description: 'Put a live view inside another page with a ready-made embed.',
    keywords:
      'iframe embed website notion confluence wiki blog integrate document session strip timer vote poll project',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'finding-community-documents',
    title: 'Finding Work in the Community',
    description:
      'Search the Community by words, #tags, category and sort, then make something your own.',
    keywords:
      'community gallery browse search find filter hashtag tag tags sort most loved copied newest category inspiration examples like heart copy duplicate report flag my shares mine own popular popularity stats hidden document plan board sheet dashboard form template deck infographic logo wireframe mockup photo poster illustration',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: {
      liveknowledge: { title: 'Finding Knowledgebases in the Community' },
      livediagram: { title: 'Finding Canvases in the Community' },
      liveplanner: { title: 'Finding Plans in the Community' },
      livedocuments: { title: 'Finding Documents in the Community' },
      livedesign: { title: 'Finding Designs in the Community' },
      livehuddle: { title: 'Finding Spaces in the Community' },
    },
  },
  {
    slug: 'live-image',
    title: 'Live Image',
    description: 'Copy an always-current image of your work for READMEs and docs.',
    keywords: 'readme badge always current screenshot png url auto updating document project',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'one-tab',
    title: 'Sharing One Tab',
    description: 'Scope a share link to one tab; the rest stays private.',
    keywords: 'single tab scope restrict part only page subset private hide limit share link',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: {
      liveknowledge: {
        title: 'Sharing One Page',
        description: 'Scope a share link to one page; the rest stays private.',
      },
    },
  },
  {
    slug: 'request-approval',
    title: 'Request Approval',
    description: 'Ask named people to approve it, and see where their answers stand.',
    keywords:
      'approve approval sign off review request changes approver badge awaiting approved changed since due note audit history signoff tab',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'liveknowledge'],
  },
  {
    slug: 'share-link-expiry',
    title: 'Share Link Expiry',
    description: 'Give a share link a lifetime so it stops working later.',
    keywords:
      'expire time limit temporary duration deadline revoke extend expired forever week month',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'share-passwords',
    title: 'Share Passwords',
    description: 'Guard every share link with one password.',
    keywords: 'protect lock secure gate private restrict access remember',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'snapshots',
    title: 'Snapshots',
    description: 'Save points for the whole work: take one, keep five, revert to one.',
    keywords:
      'snapshot save point restore revert undo backup checkpoint version rollback go back earlier copy history tools timeline take',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: { livediagram: { group: 'Working Together' } },
  },
  {
    slug: 'teams',
    title: 'Teams',
    description: 'Invite members, assign roles, and share a library across a team.',
    keywords:
      'workspace organisation organization members invite group company document manage teams liveworkspace project',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: { livediagram: { group: 'Working Together' } },
  },
  {
    slug: 'audit-log',
    title: 'Audit Log',
    description:
      'Who did what in a team, for its admins: members, shares, moves, deletes and connections.',
    keywords:
      'audit log history who shared joined removed role changed connection connections webhook export csv admin activity record compliance approval approved changes requested',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'roles-and-invites',
    title: 'Roles and Invites',
    description: 'Admin and Member roles, and inviting people by email.',
    keywords:
      'admin member permission email invite add people access decline reject rejected reminder expire expired',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'team-shared-documents',
    title: 'Team Shared Library',
    description: 'A per-team folder tree every member can manage.',
    keywords: 'shared library folder team files workspace common diagrams document',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
    apps: ['livediagram', 'livedocuments', 'livehuddle', 'liveknowledge'],
    byApp: {
      liveknowledge: { title: 'Team Shared Knowledgebases' },
      livediagram: { title: 'Team Shared Canvases' },
      livedocuments: { title: 'Team Shared Documents' },
      livehuddle: { title: 'Team Shared Spaces' },
    },
  },
  {
    slug: 'walkthroughs',
    title: 'Walkthroughs',
    description:
      'A recorded tour: a video of your tab with your voice and, if you like, your camera, played in the app or shared by a link.',
    keywords:
      'walkthrough record recording narrate narration voice video screen share tab camera webcam loom talktrack async tour explain play playback public link rename',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
    byApp: { livediagram: { group: 'Running Sessions' } },
  },
];
