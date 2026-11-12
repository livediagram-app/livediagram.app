import type { Alternative, Comparisons } from '@liveworkspace/comparisons';
import { SITE_URL } from '@livehuddle/ui';

// livehuddle's comparisons, drawn by @liveworkspace/comparisons (packages/comparisons/README.md
// "livehuddle"). The hub, every page, their metadata and the sitemap read this list, so adding a
// competitor is a one-place change. Bump the date with any change to them. Each competes on the
// competitor's own ground: the virtual office and spatial meeting place a remote team meets in. Talking
// is shared ground: livehuddle's proximity voice, camera and screen bubbles, private rooms and the stage
// are on at livehuddle.app (docs/specs/012-collaboration/proximity-audio.md "Turning calls on"), so no
// page says it has no voice or video. The retired Miro and FigJam pages redirect to the hub
// (public/_redirects).
const UPDATED = new Date('2026-11-10');

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
      { label: 'Price', us: 'Free, every feature', them: 'Free for small teams, then paid plans' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and share a Space as a guest',
        them: 'An account to create an office',
      },
      {
        label: 'Voice and video',
        us: 'Built in: proximity voice, cameras and screen shares that follow where you walk',
        them: 'Built in, and it follows where you walk',
      },
      {
        label: 'Getting in',
        us: 'Any modern browser, nothing to install',
        them: 'The browser, or its desktop apps',
      },
      {
        label: 'On the floor',
        us: 'Stickies, stickers, and a Timer and a Stopwatch for any room',
        them: 'Interactive objects, private areas and meeting rooms',
      },
      {
        label: 'Programmatic access',
        us: 'A free REST API with personal tokens',
        them: 'Integrations such as calendars',
      },
    ],
    themBest: [
      'Years of polish on its calls, from the video grid to the meeting tools around them, for teams that live in the office all day.',
      'Desktop apps that keep the office open all day, with notifications when someone comes over.',
      'A deep map maker and object library for building an office that looks exactly like yours.',
      'Calendar integration, so a scheduled meeting opens in the right room.',
    ],
    usBest: [
      'Free for everyone and MIT-licensed, with no per-seat pricing, no team-size limit on a plan, and nothing to upgrade to.',
      'Open a link and you are in, with no sign-up, even to create a Space or to talk, and nothing to install.',
      'Walk up to someone and you hear them: voices fade as you walk away, a camera or a shared screen shows as a bubble above your character, and a room’s walls keep its call private.',
      '27 templates: a blank Space, and offices, halls, bars, gardens, games rooms, houses and whole campuses to walk round, each ready to walk into.',
      'Your own character with outfits, a status (Available, Focusing, Out to Lunch, Angry and nine more, each worn on the character), speech bubbles and five moves, and Follow to go wherever a teammate goes.',
      'A Space is also a board: sticky notes, text and stickers on the walls, and a Timer or a Stopwatch in any room.',
      'Share links for each role: an Editor reshapes the office, and a Participant, the default, walks, talks, comments and reacts without moving a thing. Add a password or an expiry, or revoke a link at any time.',
      'A free REST API, so your own scripts can set up and change your Spaces.',
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
          'A meeting room is a call of its own: nobody outside its walls hears a word, so a glass-walled room shows who is in a meeting without letting it be heard. Knock before you walk in, set Do Not Disturb when you need quiet, and speak from the All-Hands Hall’s stage to be heard by everyone in the hall, with raised hands for questions. Where Gather goes further is the years of polish around its calls, its desktop apps and its calendar integration.',
        ],
      },
      {
        heading: 'More than a floor plan',
        paragraphs: [
          'Every livehuddle Space is also a board, so the walls of a room hold the meeting: sticky notes, text and stickers, with a Timer or a Stopwatch on the wall, and one person can hold the facilitator baton so the timer answers to them. Bring Focus offers everyone a jump to what you mean, and comments with mentions, reactions and assigned actions keep the follow-ups with the Space.',
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
    slug: 'teamflow',
    name: 'Teamflow',
    highlights: ['Free and open source', 'No install', 'A board in every room'],
    title: 'Teamflow alternative for a virtual office · livehuddle',
    description:
      'A free, open-source Teamflow alternative: a virtual office in the browser where your team walks between rooms as characters, with notes on the walls.',
    h1: 'The free, open-source Teamflow alternative',
    lede: 'Teamflow is a virtual office built round video: the team’s faces float in rooms you move between, with shared apps beside the call. livehuddle is a virtual office too, where everyone walks between rooms as a character, talks to whoever is near, and the walls hold the meeting. It is free, open source and needs no install.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Paid plans per user' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and share a Space as a guest',
        them: 'An account to create an office',
      },
      {
        label: 'Voice and video',
        us: 'Built in: proximity voice, camera and screen bubbles over your character',
        them: 'Built in, video bubbles that move with you',
      },
      {
        label: 'Getting in',
        us: 'Any modern browser, nothing to install',
        them: 'A desktop app, and the browser',
      },
      {
        label: 'In a room',
        us: 'Stickies, stickers, and a Timer and a Stopwatch for any room',
        them: 'Screen shares and shared apps beside the call',
      },
      {
        label: 'Programmatic access',
        us: 'A free REST API with personal tokens',
        them: 'Integrations such as calendars',
      },
    ],
    themBest: [
      'Video first: everyone’s face is on the floor, rather than a character with a camera bubble above it.',
      'Several screen shares at once in a room, so a group can compare work side by side.',
      'Apps that sit beside the call in a room, so notes and shared documents live where the conversation is.',
      'A desktop app that keeps the office running in the background all day.',
    ],
    usBest: [
      'Free for everyone and MIT-licensed, with no per-seat pricing and nothing to upgrade to.',
      'Open a link and walk in from any modern browser, with nothing to install and no sign-up, even to create a Space or to talk.',
      'Walk up to someone and you hear them, with a camera or a shared screen as a bubble above your character, and a meeting room’s walls keeping its call private.',
      'A place you can see: everyone is a character in their own colour and outfit, with a status (Available, Focusing, Out to Lunch, Angry and nine more, each worn on the character), speech bubbles and five moves.',
      '27 templates: a blank Space, and offices, halls, bars, gardens, games rooms, houses and whole campuses to walk round, and office pieces to build more rooms.',
      'The walls hold the meeting: sticky notes, text and stickers, and a Timer or a Stopwatch in any room.',
      'Bring Focus and follow-me to walk the room through something, and a burst of confetti, sparkles, hearts, applause or fireworks round your character when it goes well.',
      'Comments with mentions and reactions, and actions assigned to a teammate, so the follow-ups leave with an owner.',
      'A free REST API, so your own scripts can set up and change your Spaces.',
    ],
    sections: [
      {
        heading: 'Two kinds of virtual office',
        paragraphs: [
          'Teamflow puts the team’s video on a shared floor: you drag yourself next to someone and the conversation starts, with screen shares and apps beside you. livehuddle puts the team’s characters on a floor plan: you walk into a room, sit at the meeting table or a desk, and everyone can see where everyone is and what they are up to from their status.',
          'Both put the call in the office. In livehuddle you hear the people near you, a camera or a shared screen shows as a bubble above your character to whoever is in earshot, and a meeting room is a call of its own that nobody outside hears. If you want everyone’s face on the floor all day, or several screens shared side by side, Teamflow’s video-first floor is the better fit.',
        ],
      },
      {
        heading: 'A board in every room',
        paragraphs: [
          'A livehuddle Space is a board as well as a place. A stand-up in the Team Pod can start with a sticky note per person and a Timer on the wall. One person can hold the facilitator baton so the timer answers to them, and Bring Focus offers everyone a jump to the thing you mean.',
        ],
      },
      {
        heading: 'Open from a link, for free',
        paragraphs: [
          'There is no paid tier, no seat to buy and no app to install. Anyone can open a Space without signing up; a guest’s new Space is kept in their browser until they press Share, which syncs it in one step. A share link is an Editor or a Participant link, and can carry a password or an expiry, or be revoked at any time.',
          'The whole codebase is MIT-licensed and public. Signed in, your Spaces can sync to your own Google Drive, and a Space in This Browser never reaches our servers at all.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Does livehuddle have video like Teamflow?',
        a: 'Yes, as bubbles over the characters rather than faces on the floor. Walk up to someone and you hear each other; turn on your camera or share a screen and it shows above your character to the people in earshot, who can press it to make it bigger.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'No. livehuddle runs in any modern browser on a laptop, desktop or tablet, and a phone can join to look and walk. If you like, it installs to a computer’s or phone’s home screen like an app, straight from the browser.',
      },
      {
        q: 'Can I move my Teamflow office over?',
        a: 'There is no Teamflow importer. The Virtual Office template gives you rooms, desks and a meeting table to start from, and every piece can be moved, added or removed.',
      },
      {
        q: 'Is livehuddle really free?',
        a: 'Yes. Every feature is free for everyone, with no paid tier and no per-seat pricing. The code is MIT-licensed and public.',
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
      { label: 'Price', us: 'Free, every feature', them: 'Free plan with limits, then paid plans' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and share a Space as a guest',
        them: 'An account to create a space',
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
        us: 'Editor and Participant links, with passwords and expiry',
        them: 'Roles and permissions for members and guests',
      },
      {
        label: 'Programmatic access',
        us: 'A free REST API with personal tokens',
        them: 'Integrations such as calendars',
      },
    ],
    themBest: [
      'Large events: broadcasting to a big audience, and spaces built for parties and conferences.',
      'Music in the room.',
      'A desktop app, and a rich furniture and decor library for an office that looks its best.',
    ],
    usBest: [
      'Free for everyone and MIT-licensed: no plan limits on people or rooms, and nothing to upgrade to.',
      'Open a link and walk in, with no sign-up, even to create a Space or to talk, and nothing to install.',
      'Voices fade as you walk away, cameras and shared screens show as bubbles above the characters, and a meeting room’s walls keep its call private.',
      '27 templates: a blank Space, and offices, halls, bars, gardens, games rooms, houses and whole campuses to walk round.',
      'Everyone is a character with outfits, a status (Available, Focusing, Out to Lunch, Angry and nine more, each worn on the character), speech bubbles and five moves, and Follow takes you wherever a teammate goes.',
      'The walls hold the meeting: sticky notes, text and stickers, with a Timer or a Stopwatch in any room.',
      'Participant links let people walk, talk, comment and react without moving the furniture.',
      'A free REST API, so a script can set up a Space and share it for you.',
      'Your Spaces can sync to your own Google Drive, or stay in This Browser and never reach our servers.',
    ],
    sections: [
      {
        heading: 'A place for the team to be',
        paragraphs: [
          'Kumospace and livehuddle both turn a remote team’s day into a place: an office with rooms, desks and a corner to chat in, where you can see who is around. In livehuddle that place is a Space. Walk in as your own character, sit at your desk, set your status to Focusing when you need quiet, and walk over to the meeting table when it is time to talk.',
          'For the whole company there is the All-Hands Hall, with a stage at the front that everyone in the hall hears, and raised hands for the audience to ask to speak, or a Conference Venue and an Expo Hall for the bigger day, and everyone can throw a burst of confetti, sparkles, hearts, applause or fireworks when the news lands.',
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
          'Every Space is also a board. Put a sticky note per person on the wall for the stand-up, and start the Timer on the wall. Bring Focus offers everyone a jump to what you mean, and comments with mentions and assigned actions carry the follow-ups out of the meeting.',
        ],
      },
      {
        heading: 'Free, open and yours',
        paragraphs: [
          'There is no paid tier and no plan to introduce one. The whole codebase is MIT-licensed and public. Anyone can create a Space without signing up; a guest’s new Space is kept in their browser until they press Share, which syncs it in one step. Export a tab as PNG, SVG, PDF or a JSON file that imports back, and script the rest with the free REST API.',
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
        a: 'Yes. The All-Hands Hall has a stage at the front and room for the whole team to walk in: whoever stands on the stage is heard by everyone in the hall, the audience raises a hand to ask to speak, and everyone can throw applause and confetti. Kumospace is the better pick for broadcasting to a very large audience.',
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
      'Honest, side-by-side comparisons of livehuddle with Gather, Teamflow and Kumospace as a virtual office, including where each is the better pick.',
    heading: 'How livehuddle compares',
    lede: 'Looking for a virtual office for your team? Here is an honest, side-by-side look at how livehuddle compares with the spatial meeting tools you may know, including where each one is the better pick.',
  },
  alternatives: LIST,
};
