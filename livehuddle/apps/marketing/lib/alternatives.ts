import type { Alternative, Comparisons } from '@liveworkspace/comparisons';
import { SITE_URL } from '@livehuddle/ui';

// livehuddle's comparisons, drawn by @liveworkspace/comparisons (packages/comparisons/README.md
// "livehuddle"). The hub, every page, their metadata and the sitemap read this list, so adding a
// competitor is a one-place change. Bump the date with any change to them. Each competes on the
// competitor's own ground: the virtual office and spatial meeting place a remote team meets in. Talking
// is shared ground: livehuddle's proximity voice, camera and screen bubbles, private rooms and the stage
// are on at livehuddle.app (docs/specs/012-collaboration/proximity-audio.md "Turning calls on"), so no
// page says it has no voice or video. The retired Miro, FigJam and Teamflow pages redirect to
// the hub (public/_redirects).
//
// Every competitor claim below was checked against the competitor's own public pages on 2026-11-18 and
// is dated by UPDATED. A claim no current page confirms is softened or left out, never kept from memory.
// Sources (re-check each when bumping UPDATED):
//   Gather: https://www.gather.town/pricing (Essential $12 per member a month after a 30-day trial, no
//     free tier; guests not charged; Google Calendar sync, Chrome extension, GitHub and Spotify, custom
//     integrations by webhooks from Smart Objects; meeting recording, AI meeting notes and transcriptions;
//     chat with channels and DMs; mini mode; mobile app),
//     https://www.gather.town/download (Mac and Windows desktop apps, an iOS app, Android coming soon),
//     https://support.gather.town/hc/en-us/articles/15909789090452 (a web browser works too, Chrome
//     preferred), https://www.gather.town/ (walk up and talk, office customisation).
//   Kumospace: https://www.kumospace.com/pricing (Free up to 5 members and 50 guests, Business $16 per
//     member a month, user roles and furniture on every plan, recording and password or email allowlist
//     access controls on Business), https://www.kumospace.com/ (spatial audio, virtual events, a webinar
//     platform for large broadcasts, Google Calendar, Outlook, Slack, Teams, Zoom and Google Drive
//     integrations, apps for Mac, Windows, Linux, iOS and Android),
//     https://www.kumospace.com/help/invite (guests join without an account when the host allows it).
const UPDATED = new Date('2026-11-18');

const LIST: Alternative[] = [
  {
    slug: 'gather',
    name: 'Gather',
    highlights: ['Free, no tiers', 'No sign-up to create', 'Any browser, no install'],
    title: 'Gather alternative for a virtual office · livehuddle',
    description:
      'A free, open-source Gather alternative: walk your team round a virtual office as characters, meet in rooms, no account, no install and no per-seat plan.',
    h1: 'The free, open-source Gather alternative',
    lede: 'Gather made the pixel-art virtual office popular: walk up to a teammate and the call starts. livehuddle is a virtual office in the same spirit, free and open source, that anyone opens from a link without an account: walk up to someone and you hear each other, turn on a camera or share a screen, and step into a room for a private word.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'Paid per member after a 30-day free trial',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, a hosted product' },
      {
        label: 'Start without an account',
        us: 'Yes, create and share a Space as a guest',
        them: 'Members sign up and pay per seat; guests are not charged',
      },
      {
        label: 'Voice and video',
        us: 'Built in: proximity voice, cameras and screen shares that follow where you walk',
        them: 'Built in, and it follows where you walk',
      },
      {
        label: 'Getting in',
        us: 'Any modern browser, nothing to install',
        them: 'The browser, or its Mac, Windows and iOS apps',
      },
      {
        label: 'Seeing the office',
        us: 'A 3D View with standing walls, framed doorways and upright characters, or the flat plan',
        them: 'A customisable pixel-art office',
      },
      {
        label: 'On the floor',
        us: 'Stickies, stickers, a Timer and a Stopwatch, and playable pieces like the Arcade Machine and the Ping-Pong Table',
        them: 'A customisable office with smart objects',
      },
      {
        label: 'Programmatic access',
        us: 'A free REST API with personal tokens, and webhooks to Slack, Teams or signed JSON',
        them: 'Calendar, GitHub and Spotify integrations, and webhooks from smart objects',
      },
    ],
    themBest: [
      'Years of polish on its calls, with meeting recording, AI meeting notes and transcripts on its paid plan.',
      'Team chat with channels and direct messages, beside the office.',
      'Desktop apps for Mac and Windows and an iOS app that keep the office open all day, with in-app reminders for your calendar.',
      'Deep office customisation, with smart objects that connect to your other tools.',
      'Calendar sync, so a scheduled meeting opens in the right room.',
    ],
    usBest: [
      'Free for everyone and MIT-licensed, with no per-seat pricing, no trial that runs out, no team-size limit on a plan, and nothing to upgrade to.',
      'Open a link and you are in, with no sign-up, even to create a Space or to talk, and nothing to install.',
      'Walk up to someone and you hear them: voices fade as you walk away, a camera or a shared screen shows as a bubble above your character, and a room’s walls keep its call private.',
      'Walk the office in 3D: walls stand up with framed doorways and windows, characters stand upright, and the walls in front of you fade as you near a room.',
      'In Chrome or Edge, Pop Out a small window that stays on top while you work in another tab: who is near you, who is talking, raised hands and knocks, your microphone and camera, and up to four camera tiles.',
      '33 templates: a blank Space, and offices, halls, bars, gardens, galleries, games rooms, houses and whole campuses to walk round, each ready to walk into.',
      'Your own character with outfits, a status (Available, Focusing, Out to Lunch, Angry and nine more, each worn on the character), speech bubbles and five moves, and Follow to go wherever a teammate goes.',
      'A Receptionist by the Avatar Pad who welcomes newcomers and answers how-do-I questions by pointing at the real control.',
      'A Space is also a board: sticky notes, text and stickers on the walls, and a Timer or a Stopwatch in any room.',
      'Share links for each role: an Editor reshapes the office, and a Participant, the default, walks, talks and reacts without moving a thing. Add a password or an expiry, or revoke a link at any time.',
      'A free REST API and webhooks, so your own scripts can set up your Spaces and Slack or Teams hears when one is renamed, moved, shared or trashed.',
      'Your Spaces can sync to your own Google Drive, or stay in This Browser and never reach our servers.',
    ],
    sections: [
      {
        heading: 'A virtual office, open from a link',
        paragraphs: [
          'Gather and livehuddle share the idea that a remote team should meet in a place, not a grid of faces: everyone is a little character, the office has rooms, desks and a coffee corner, and you can see who is around before you say hello. In livehuddle you walk in as your own pixel character in your own colour, sit at a desk or round the meeting table, show a status above your head, and talk in speech bubbles. Portals take everyone from one room or tab to the next.',
          'Start from the Virtual Office, the Team Pod, the Coworking Space or the All-Hands Hall, or build your own from rooms, walls, desks, chairs, sofas, meeting tables, rugs, plants, bookshelves, a water cooler and a coffee machine.',
        ],
      },
      {
        heading: 'Talking as you walk',
        paragraphs: [
          'Gather’s heart is proximity video and audio: the people near you are the people you hear, and livehuddle works the same way. Walk up to a teammate and you hear each other, the voice fading as you walk apart; a little equaliser over a character shows who is talking further off. Your microphone starts muted, a camera or a shared screen shows as a bubble above your head to the people in earshot, and anyone can press a bubble to make it bigger.',
          'A meeting room is a call of its own: nobody outside its walls hears a word, so a glass-walled room shows who is in a meeting without letting it be heard. Knock before you walk in, set Do Not Disturb when you need quiet, and speak from the All-Hands Hall’s stage to be heard by everyone in the hall, with raised hands for questions. Where Gather goes further is the years of polish around its calls, with recording and AI meeting notes, its team chat, its desktop apps and its calendar sync.',
          'Step away from the Space and you still hear it: a soft chime when someone arrives or leaves, a Nudge from a teammate that reaches you as a desktop notification, and, in Chrome or Edge, a Pop Out window that keeps your microphone, your camera and the people near you on top of whatever you are working on.',
        ],
      },
      {
        heading: 'More than a floor plan',
        paragraphs: [
          'Every livehuddle Space is also a board, so the walls of a room hold the meeting: sticky notes, text and stickers, with a Timer or a Stopwatch on the wall that anyone in the room can run. Bring Focus offers everyone a jump to what you mean.',
          'Walk the office in 3D, with its walls standing and its doorways framed, or flat as a plan. The office has a life of its own: a Receptionist welcomes newcomers, the Arcade Machine keeps a High Scores table for the whole Space, two people can play on the Ping-Pong Table while everyone watches, and a Nap Pod or a Treadmill sets your status as you sit down.',
        ],
      },
      {
        heading: 'Free means free, and open',
        paragraphs: [
          'livehuddle has no paid tier and no plan to introduce one: every user gets every feature at livehuddle.app. The whole codebase is MIT-licensed and public, so anyone can read exactly how it works. A guest’s new Space is kept in their browser until they press Share, which syncs it in one step, and accounts are optional.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can we talk by voice or video in livehuddle like we do in Gather?',
        a: 'Yes. Walk up to someone and you hear each other, and turn on a camera or share a screen to show it as a bubble above your character. A meeting room’s walls keep its call private, and whoever stands on a stage is heard by everyone on its tab. Guests on a Participant link talk too, with no sign-in.',
      },
      {
        q: 'Can I bring my Gather office across?',
        a: 'There is no Gather importer. Start from the Virtual Office template and rearrange its rooms, or build your own from the office pieces.',
      },
      {
        q: 'Do my teammates need an account or an app?',
        a: 'Neither. Share a link and anyone who opens it walks into the Space in a modern browser, without signing up or installing anything. Accounts are optional and mainly keep your Spaces across devices and let you use teams.',
      },
      {
        q: 'Is livehuddle really free?',
        a: 'Yes. Every feature is free for everyone, with no paid tier and no team-size limit on a plan. The code is MIT-licensed and public.',
      },
    ],
  },
  {
    slug: 'kumospace',
    name: 'Kumospace',
    highlights: ['Free, every feature', 'No sign-up to create', 'Share roles built in'],
    title: 'Kumospace alternative for a virtual office · livehuddle',
    description:
      'A free, open-source Kumospace alternative: a virtual office and all-hands hall your team walks round as characters, from a link, with no account needed.',
    h1: 'The free, open-source Kumospace alternative',
    lede: 'Kumospace is a polished virtual office with spatial audio and video, built for a team’s everyday office and for bigger gatherings. livehuddle gives a team the same sense of place, rooms to walk into, people to find and voices that grow louder as you walk closer, as free, open-source software anyone opens from a link.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'Free for up to 5 members, then $16 per member a month',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, a hosted product' },
      {
        label: 'Start without an account',
        us: 'Yes, create and share a Space as a guest',
        them: 'An account to create a space; guests join by link if the host allows it',
      },
      {
        label: 'Voice and video',
        us: 'Proximity voice, cameras and screen shares built in',
        them: 'Spatial audio and video built in',
      },
      {
        label: 'Big gatherings',
        us: 'An All-Hands Hall whose stage everyone in the hall hears',
        them: 'Event spaces and broadcasting to a crowd',
      },
      {
        label: 'Who can do what',
        us: 'Editor and Participant links with an optional expiry, and a password for the Space, free',
        them: 'User roles on every plan; passwords and an email allowlist on its paid plan',
      },
      {
        label: 'Seeing the office',
        us: 'A 3D View with standing walls, framed doorways and upright characters, or the flat plan',
        them: 'A customisable office with furniture and decor',
      },
      {
        label: 'Programmatic access',
        us: 'A free REST API with personal tokens, and webhooks to Slack, Teams or signed JSON',
        them: 'Calendar, Slack, Teams, Zoom and Google Drive integrations',
      },
    ],
    themBest: [
      'Large events: a webinar platform for broadcasting to a big audience, and spaces built for parties and conferences.',
      'Recording, chat channels and user analytics on its paid plan.',
      'Desktop apps for Mac, Windows and Linux and mobile apps for iOS and Android.',
      'Integrations with the calendars and chat tools a team already uses, from Google Calendar and Outlook to Slack, Teams and Zoom.',
      'Furniture and decor you can customise for an office that looks its best.',
    ],
    usBest: [
      'Free for everyone and MIT-licensed: no plan limits on people, guests, floors or rooms, and nothing to upgrade to.',
      'Open a link and walk in, with no sign-up, even to create a Space or to talk, and nothing to install.',
      'Voices fade as you walk away, cameras and shared screens show as bubbles above the characters, and a meeting room’s walls keep its call private.',
      'Walk the office in 3D: walls stand up with framed doorways and windows, characters stand upright, and the walls in front of you fade as you near a room.',
      'Floors are tabs, joined by Stairs and Elevators, on every Space for free.',
      '33 templates: a blank Space, and offices, halls, bars, gardens, galleries, games rooms, houses and whole campuses to walk round.',
      'Everyone is a character with outfits, a status (Available, Focusing, Out to Lunch, Angry and nine more, each worn on the character), speech bubbles and five moves, and Follow takes you wherever a teammate goes.',
      'Knock before walking in on a meeting, Nudge a teammate from Collaborators, and see who came and went in a tab’s Attendance.',
      'The walls hold the meeting: sticky notes, text and stickers, with a Timer or a Stopwatch in any room.',
      'Participant links let people walk, talk and react without moving the furniture, and a Space can take a password and any link an expiry.',
      'A free REST API and webhooks, so a script can set up a Space and Slack or Teams hears when it is renamed, moved, shared or trashed.',
      'Your Spaces can sync to your own Google Drive, or stay in This Browser and never reach our servers.',
    ],
    sections: [
      {
        heading: 'A place for the team to be',
        paragraphs: [
          'Kumospace and livehuddle both turn a remote team’s day into a place: an office with rooms, desks and a corner to chat in, where you can see who is around. In livehuddle that place is a Space. Walk in as your own character, sit at your desk, set your status to Focusing when you need quiet, and walk over to the meeting table when it is time to talk.',
          'For the whole company there is the All-Hands Hall, with a stage at the front that everyone in the hall hears, and raised hands for the audience to ask to speak, or a Conference Venue and an Expo Hall for the bigger day. When the news lands, the whole hall can wave, cheer or dance.',
        ],
      },
      {
        heading: 'Talking in the office',
        paragraphs: [
          'Kumospace is built on spatial audio and video, and so is livehuddle: you hear the people near you, louder as you walk closer, and a camera or a shared screen shows as a bubble above your character to whoever is in earshot. A meeting room is a call of its own, so nobody in the corridor hears it, and Do Not Disturb stops voices reaching you when you need to focus. For a large event broadcast to a crowd, Kumospace is the better pick.',
        ],
      },
      {
        heading: 'A meeting you can write on',
        paragraphs: [
          'Every Space is also a board. Put a sticky note per person on the wall for the stand-up, and start the Timer on the wall. Bring Focus offers everyone a jump to what you mean, and a Snapshot keeps the wall as it was before you start again.',
        ],
      },
      {
        heading: 'Free, open and yours',
        paragraphs: [
          'There is no paid tier and no plan to introduce one. The whole codebase is MIT-licensed and public. Anyone can create a Space without signing up; a guest’s new Space is kept in their browser until they press Share, which syncs it in one step. Export a tab as PNG, SVG, a PDF with real, selectable text, or a JSON file that imports back, and script the rest with the free REST API.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can we talk in livehuddle the way we do in Kumospace?',
        a: 'Yes. Walk up to someone and you hear each other, louder as you get closer; turn on a camera or share a screen and it shows as a bubble above your character. Step into a meeting room and only the people inside hear you.',
      },
      {
        q: 'Can I hold an all-hands in livehuddle?',
        a: 'Yes. The All-Hands Hall has a stage at the front and room for the whole team to walk in: whoever stands on the stage is heard by everyone in the hall, the audience raises a hand, and the speaker presses Let Speak to give someone the floor. Kumospace is the better pick for broadcasting to a very large audience.',
      },
      {
        q: 'Can I import my Kumospace office?',
        a: 'There is no Kumospace importer. Start from the Virtual Office or Coworking Space template and arrange the office pieces to match.',
      },
      {
        q: 'Do guests need an account?',
        a: 'No. Share a link and anyone who opens it is in the Space with you, without signing up. You do not need an account to create a Space either.',
      },
    ],
  },
];

export const COMPARISONS: Comparisons = {
  app: 'livehuddle',
  siteUrl: SITE_URL,
  updated: UPDATED,
  hub: {
    title: 'How livehuddle compares · alternatives',
    description:
      'Honest, side-by-side comparisons of livehuddle with Gather and Kumospace as a virtual office, including where each is the better pick.',
    heading: 'How livehuddle compares',
    lede: 'Looking for a virtual office for your team? Here is an honest, side-by-side look at how livehuddle compares with the spatial meeting tools you may know, including where each one is the better pick.',
  },
  alternatives: LIST,
};
