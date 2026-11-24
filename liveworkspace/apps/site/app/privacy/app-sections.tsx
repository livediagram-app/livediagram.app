// What only one app does beyond the rest, under App by app on the privacy policy (page.tsx).
import type { LegalSection } from '@/components/LegalPage';

export const APP_SECTIONS: LegalSection[] = [
  {
    app: 'livediagram.app',
    id: 'livediagram-sticky-notes',
    title: 'Reading sticky notes from a photo',
    body: (
      <p>
        When you import a photo of sticky notes, the notes are found in your browser, and crops of
        them are sent through our API to <strong>Google</strong> (Gemini) to read the handwriting.
        We do not store the crops.
      </p>
    ),
  },
  {
    app: 'liveplanner.app',
    id: 'liveplanner-everything-above',
    title: 'Nothing beyond the above',
    body: (
      <p>
        liveplanner&rsquo;s boards, sheets, dashboards and forms are stored as described under{' '}
        <a href="#what-the-apps-store">What the apps store</a>, and what its AI features (Describe a
        Plan and the card AI steps) send is under <a href="#ai-features">AI features</a>. It handles
        your data in no way of its own.
      </p>
    ),
  },
  {
    app: 'livedocuments.app',
    id: 'livedocuments-everything-above',
    title: 'Nothing beyond the above',
    body: (
      <p>
        livedocuments&rsquo; articles, slides and infographics are stored as described under{' '}
        <a href="#what-the-apps-store">What the apps store</a>. It handles your data in no way of
        its own.
      </p>
    ),
  },
  {
    app: 'livedesign.app',
    id: 'livedesign-everything-above',
    title: 'Nothing beyond the above',
    body: (
      <p>
        livedesign&rsquo;s logos and wireframes are stored as described under{' '}
        <a href="#what-the-apps-store">What the apps store</a>, and photos you edit are images you
        upload, handled the same way. It handles your data in no way of its own.
      </p>
    ),
  },
  {
    app: 'liveknowledge.app',
    id: 'liveknowledge-everything-above',
    title: 'Search, Ask and agents',
    body: (
      <p>
        liveknowledge&rsquo;s knowledgebases and their pages are stored as described under{' '}
        <a href="#what-the-apps-store">What the apps store</a>, and each knowledgebase&rsquo;s
        search index is kept in its own storage beside its pages. What Ask and its other AI features
        send, and a knowledgebase&rsquo;s own AI key, are under{' '}
        <a href="#ai-features">AI features</a>. An agent connected through its MCP server sees only
        what the person or token it acts for can open.
      </p>
    ),
  },
  {
    app: 'livehuddle.app',
    id: 'livehuddle-calls',
    title: 'Talking, cameras and screen sharing',
    body: (
      <>
        <p>
          In a Space you can talk to the people near your character, turn on your camera and share
          your screen. livehuddle&rsquo;s spaces, and everything on their boards, are stored as
          described under <a href="#what-the-apps-store">What the apps store</a>; what you say and
          show in a call is not stored at all.
        </p>
        <ul>
          <li>
            <strong>Only when you choose.</strong> Your microphone opens only after you press{' '}
            <strong>Join Audio</strong>, your camera only when you turn it on, and your screen only
            when you pick what to share, each after your browser asks your permission. Your
            microphone closes on its own when nobody else has been on your tab for 15 seconds.
            Screen sharing sends no sound. A camera or screen you turn on outside a call is a
            preview only you see, and nothing is sent.
          </li>
          <li>
            <strong>Relayed, never recorded.</strong> Your voice, camera and screen travel from your
            browser through Cloudflare&rsquo;s realtime service (Cloudflare Realtime, with its TURN
            relay) to the people who can hear you, never straight to their browsers, so they do not
            see your IP address. Our server sets up each connection but never receives the sound or
            picture, and we do not record, transcribe or keep any of it.
          </li>
          <li>
            <strong>Who hears and sees you.</strong> The people near your character, or in the same
            room, hear you, and see your camera and screen. Speaking from a stage, or once someone
            lets you speak, everyone on the tab hears you; they also see your camera and screen only
            if the stage is set to show cameras. Everyone on your tab can see when you are talking
            (a small level meter above your character, never the sound). Someone with view access
            can listen but never speak or turn on a camera.
          </li>
          <li>
            <strong>Your character.</strong> Where your character walks, the messages it says, its
            status, a raised hand and a knock on a door are sent live to the people in the Space,
            and never stored. A message is never shown to anyone who arrives later. How your
            character looks is kept in your browser.
          </li>
          <li>
            <strong>Music and video in a Space.</strong> A Jukebox plays an audio stream from a link
            an editor set, loaded by your browser from wherever it is hosted (which sees your IP
            address), and only after you have pressed its Play. A Screen&rsquo;s video loads from
            YouTube, Vimeo or Loom, like any embedded video.
          </li>
          <li>
            <strong>Counting.</strong> The anonymous product events count that someone joined a
            call, muted, or turned on a camera or a screen share, never who, for how long, or
            anything said or shown.
          </li>
        </ul>
        <p>livehuddle has no MCP server, so connected AI tools reach it only with an API token.</p>
      </>
    ),
  },
];
