import { lucideGlyph } from '@livediagram/ui';
import {
  lucideChartLine,
  lucideEyeOff,
  lucideHandshake,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import type { Metadata } from 'next';
import { LegalPage, type LegalHighlight, type LegalSection } from '@/components/LegalPage';
import { SECURITY_ADVISORY_URL } from '@liveworkspace/sites/security';
import { CONTACT_URL, LEGAL_UPDATED } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy · liveworkspace',
  description:
    'What liveworkspace and its apps (livediagram, liveplanner, livedocuments, livedesign and livehuddle) do, and do not do, with your data.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy · liveworkspace',
    description:
      'What liveworkspace and its apps (livediagram, liveplanner, livedocuments, livedesign and livehuddle) do, and do not do, with your data.',
    url: '/privacy',
    siteName: 'liveworkspace',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy · liveworkspace',
    description:
      'What liveworkspace and its apps (livediagram, liveplanner, livedocuments, livedesign and livehuddle) do, and do not do, with your data.',
  },
};

const HandshakeIcon = lucideGlyph(lucideHandshake, 20);
const EyeOffIcon = lucideGlyph(lucideEyeOff, 20);
const ChartLineIcon = lucideGlyph(lucideChartLine, 20);
const Trash2Icon = lucideGlyph(lucideTrash2, 20);

const HIGHLIGHTS: LegalHighlight[] = [
  {
    icon: <HandshakeIcon />,
    title: 'Never sold',
    body: 'Your data is never sold, and never used to train AI models.',
  },
  {
    icon: <EyeOffIcon />,
    title: 'No ads or trackers',
    body: 'No advertising, no tracking pixels, no third-party analytics.',
  },
  {
    icon: <ChartLineIcon />,
    title: 'Open numbers',
    body: 'The few anonymous totals we count are public, for anyone to see.',
  },
  {
    icon: <Trash2Icon />,
    title: 'Gone when you say',
    body: 'Delete a document or your whole account yourself, any time.',
  },
];

// The one privacy policy for liveworkspace.app and every app in it (liveworkspace/docs/specs/010-site/site.md
// "Privacy and terms"). Built from the apps' own policies, which said the same things app by app.
// What every app does is said once; what only one app does is in that app's section.
const SECTIONS: LegalSection[] = [
  {
    id: 'your-liveworkspace-account',
    title: 'Your liveworkspace account',
    body: (
      <>
        <p>
          One account signs you in to every app. It lives at liveworkspace.app, and you only need
          one if you want to: every app works without signing in.
        </p>
        <ul>
          <li>
            <strong>What it holds.</strong> Your email address and your first and last name. You
            confirm the address with a 6-digit code we email you, or by continuing with Google, in
            which case we take your name and email from Google. We never ask for a password.
          </li>
          <li>
            <strong>Your Google picture, if you sign in with Google.</strong> We keep the address of
            the profile picture Google gives us at sign-in (never the image itself), and update it
            at your next Google sign-in. Your avatar shows it to you, and to other signed-in people
            you work with, in every app; guests and people signed out never receive it. Turn off{' '}
            <strong>Show My Google Picture</strong> in Settings, Profile, and everyone else sees
            your initials instead. Each browser loads the picture straight from Google, without
            saying which page it is on.
          </li>
          <li>
            <strong>Signing in to an app.</strong> When an app sends you to liveworkspace.app to
            sign in, we give that app a short-lived token naming your account, your email and your
            name, and keep a record of which apps you have signed in to, and when you first did, so
            you aren&rsquo;t asked again.
          </li>
          <li>
            <strong>Your teams.</strong> Each team&rsquo;s name, and for each member their account,
            email address and role. If you invite someone, we store the address you typed and email
            them the invitation, with up to three reminders (after a day, a week and three weeks)
            while nobody has answered it, each with a link to decline it. It waits on
            liveworkspace.app until they accept or decline it, or until 28 days pass unanswered,
            when it expires and they are not emailed again. The token an app gets when you sign in
            also lists the teams you are in, which is how we decide who may open a team&rsquo;s
            work. The apps keep no copy of your teams.
          </li>
          <li>
            <strong>API tokens, if you create them.</strong> We store a one-way hash of each token
            (never the token itself), its name, whether it is read-only, and when it was last used.
            A token works in every app, expires after six months and is deleted with your account.
            An app that a token is used with keeps a note of that token (never the secret) and of
            anything paired through it, such as a workbench.
          </li>
          <li>
            <strong>Your onboarding emails.</strong> Which of the onboarding emails we have sent
            you, which milestone emails each app has sent you, and when you last saved something in
            any app, which is how we know whether to nudge you.
          </li>
          <li>
            <strong>Keeping abuse out.</strong> The sign-in pages use Cloudflare Turnstile to check
            you are a person, and we count code requests per network address and per email address
            for a minute at a time, so nobody can flood an inbox. Codes expire after 10 minutes and
            are stored only as a hash.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'what-the-apps-store',
    title: 'What the apps store',
    body: (
      <ul>
        <li>
          <strong>Your documents.</strong> What you make is saved so it is there when you come back,
          and so the people you share it with can see it. Each document is stored on its own on
          Cloudflare, with its comments beside what they are about. While people work on one
          together, each comment, answer, idea and vote that passes through the live session is also
          noted in that document&rsquo;s own storage, so none is lost or counted twice, and is
          removed with it. A document you make in <strong>Offline Mode</strong> (This Browser),
          which every app has, stays in your browser and never reaches our servers, unless you use
          an AI feature on it or add a web link to it (our server fetches the link&rsquo;s preview).
          A guest&rsquo;s new documents start in This Browser; someone signed in starts on our
          servers. Either can move a document between the two.
        </li>
        <li>
          <strong>Your Explorer.</strong> liveworkspace.app keeps one list of what you make in every
          app, so the Explorer in each app can show all of it: each document&rsquo;s title, app,
          owner, team, folder, favourite and Trash state, its share links, when you last opened it,
          and a small summary for its card (such as how many elements it has). For the Timeline it
          keeps what happened to each document (created, renamed, shared, commented on) and who did
          it, and for the Inbox it keeps, for each comment thread and action, who is in it, whether
          it is resolved or done, and the start of the latest comment (up to 500 characters).
        </li>
        <li>
          <strong>Images you upload</strong> are kept in Cloudflare object storage. Before a JPEG is
          stored, identifying metadata such as GPS location and camera details is stripped from it.
          An uploaded image that no document uses is removed once it is more than 30 days old.
        </li>
        <li>
          <strong>A guest id.</strong> If you use an app without an account, liveworkspace.app gives
          your browser a random guest id, the same in every app, to link your documents to your
          browser. It is not tied to your name or email. We note the day it was last handed to an
          app. If you later sign in or create an account, what you made as a guest becomes your
          account&rsquo;s.
        </li>
        <li>
          <strong>Your display name and colour</strong>, the ones collaborators see, against your
          guest id or account. liveworkspace.app keeps them, so they are the same in every app; an
          account shows its own name until you choose a display name.
        </li>
        <li>
          <strong>Connected AI tools, if you connect one.</strong> If you connect a tool through an
          app&rsquo;s MCP server (every app has one but livehuddle), we store the tool&rsquo;s
          registration (its name and redirect address, for 30 days), short-lived authorisation codes
          that expire within minutes, and for an hour a count of registrations from your network
          address, to stop abuse.
        </li>
        <li>
          <strong>Form responses.</strong> Each response to a form you publish is stored in your
          document, holding only what the person typed. People filling in a form need no account,
          and we store no name, account or browser id for them. A report about a form stores its
          reason, an optional note, a random key kept in the reporter&rsquo;s browser and a one-way
          hash of their network.
        </li>
        <li>
          <strong>Votes from guests.</strong> To stop one person voting many times, a guest&rsquo;s
          vote stores a one-way hash of their network address combined with the document&rsquo;s id.
          It is deleted with the document.
        </li>
        <li>
          <strong>Operational logs.</strong> Our host, Cloudflare, keeps standard request logs that
          help us run the service securely.
        </li>
      </ul>
    ),
  },
  {
    id: 'the-community',
    title: 'The Community',
    body: (
      <>
        <p>
          Each app&rsquo;s Community is a public gallery of documents people choose to share. Its
          posts, likes, copies and reports are kept by liveworkspace, in one database for every
          app&rsquo;s Community; the documents themselves stay in each app.
        </p>
        <ul>
          <li>
            <strong>A post</strong> holds the title, description, category and tags you write, which
            document it shows, when you shared it, and its like and copy counts. Your account is
            stored with it so you can manage it, but never shown: the post appears as Anonymous, or,
            if you turn that off, with your display name and picture. Removing the post, or deleting
            the document or your account, deletes it.
          </li>
          <li>
            <strong>Likes, copies and reports</strong> are stored against a random key your browser
            keeps for the Community, not against you, with a one-way hash of your network combined
            with the post&rsquo;s id, so one network can add only a few. A report stores its reason
            and an optional note too. Reports are counted automatically; nobody reads them by hand.
          </li>
          <li>
            <strong>Posts are public.</strong> Anyone can find, view and copy a shared document, and
            it shows the document&rsquo;s latest version, including its document and tab names,
            until you remove it. Comments are never shown with it. Copies people made before you
            removed it remain theirs.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ai-features',
    title: 'AI features',
    body: (
      <>
        <p>The AI features run only when you use them, and only where an AI provider is set up.</p>
        <ul>
          <li>
            <strong>Connected AI tools</strong>, such as Claude, read and change your documents
            through our API with the token you approved. What the tool does with what it reads is
            governed by its own terms and privacy policy.
          </li>
        </ul>
        <p>We do not use your documents to train AI models.</p>
      </>
    ),
  },
  {
    id: 'image-search',
    title: 'Image search',
    body: (
      <p>
        In livediagram, livedocuments, livedesign and livehuddle, the image picker&rsquo;s Search
        tab sends your search words from your browser to <strong>Openverse</strong>, run by the
        WordPress Foundation, which sees them and your IP address under its own privacy policy; our
        servers never see the search. A picture you pick is downloaded from its original host and
        stored like any image you upload.
      </p>
    ),
  },
  {
    id: 'anonymous-product-analytics',
    title: 'Anonymous product analytics',
    body: (
      <>
        <p>
          To learn which features actually help, the apps and the Explorer on liveworkspace.app
          record anonymous, first-party product events, such as &ldquo;a document was
          created&rdquo;. Each event is a few fixed labels (a category, an action and an optional
          type) and the app it came from (the Explorer&rsquo;s count for the app it shows, or for
          liveworkspace.app). Events never include anything that identifies you or your work: no
          names, no content, no account id, no IP address. Page views are counted the same way, with
          ids and anything after a <code>?</code> or <code>#</code> removed in your browser first,
          as are errors (only a generic kind) and timings (only the range they fell in).
        </p>
        <p>
          Your browser sends them straight to liveworkspace&rsquo;s telemetry service at
          liveworkspace.app, without cookies, which keeps them in its own database, apart from your
          documents and account, for 60 days. To count sign-ups and sign-ins once each, an
          app&rsquo;s server also remembers which sessions it has already counted, for 90 days, and
          that an account has been seen before (deleted with the account). Only the totals are
          published. The data is never sold or shared: the only place it goes beyond our own use is
          the public <a href="/telemetry">telemetry dashboard</a>, which shows exactly the totals we
          see. You can turn off the events your browser sends: signed in, one setting turns them off
          in every app and on liveworkspace.app; as a guest, in each app&rsquo;s Settings, and on
          liveworkspace.app your browser&rsquo;s Global Privacy Control or Do Not Track does. A few
          totals are counted by our servers and can&rsquo;t be turned off: sign-ups and sign-ins,
          first visits to a share link, multiplayer sessions, emails sent and server errors.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-do-not-do',
    title: 'What we do not do',
    body: (
      <p>
        We do not use tracking pixels, advertising, or third-party analytics. We do not sell your
        data, and we do not build advertising profiles.
      </p>
    ),
  },
  {
    id: 'cookies-and-local-storage',
    title: 'Cookies and local storage',
    body: (
      <p>
        If you sign in, liveworkspace.app sets a cookie to keep you signed in, and each app you use
        sets its own to remember that you are, with your name, colour and Google picture (if you
        have one) for its header. If you use an app without an account, liveworkspace.app sets a
        cookie holding your guest id. The apps keep your guest id, your preferences (also saved to
        our database so they follow you) and your Community key in local storage, and
        liveworkspace.app keeps your light or dark choice there. We do not use advertising or
        tracking cookies.
      </p>
    ),
  },
  {
    id: 'emails-we-send',
    title: 'Emails we send',
    body: (
      <>
        <ul>
          <li>
            <strong>Sign-in codes</strong>, from liveworkspace.app, when you ask for one, and the
            code that confirms you want to delete your account.
          </li>
          <li>
            <strong>Account and service emails</strong>: team invitations from liveworkspace.app
            (with up to three reminders while unanswered), a confirmation when you delete your
            account, a one-time reminder a week before an API token expires, a link when a download
            of your data is ready (or a note if it failed), and a note if one of your forms is
            suspended after reports.
          </li>
          <li>
            <strong>Notifications about your work</strong>: when someone first opens a document you
            shared, comments on one you own, fills in one of your forms, answers a team invitation
            you sent, assigns you an action or mentions you. A mention quotes the comment (up to
            about 280 characters); an assigned action includes its name and the start of its
            description.
          </li>
          <li>
            <strong>A short onboarding series</strong>: a welcome, a few tips in your first two
            weeks, a nudge if you haven&rsquo;t made anything or have been away a while, and the
            occasional milestone.
          </li>
        </ul>
        <p>
          You can turn off every notification, tip and milestone email in each app&rsquo;s Settings,
          or from the link at the bottom of each one. We send no advertising, and share your address
          only with our email provider, Cloudflare, to deliver these. People who use an app without
          an account are never emailed, apart from team invitations and what follows from them.
        </p>
      </>
    ),
  },
  {
    id: 'phone-notifications',
    title: 'Phone notifications',
    body: (
      <>
        <p>
          If you have an account and turn on phone notifications, we tell that phone or browser when
          someone mentions you, assigns you an action, replies in a thread you are in, or comments
          on something you own.
        </p>
        <ul>
          <li>
            <strong>What we keep</strong> for each device you turn them on for: the address your
            browser&rsquo;s push service gave it, the two keys that encrypt messages to it, a label
            naming the browser and system (such as &ldquo;Safari on iOS&rdquo;), the app you turned
            them on in, and when one last reached it.
          </li>
          <li>
            <strong>What a notification says</strong>: who did it and the name of the item, the
            app&rsquo;s name and a link, never the words of a comment or an action.
          </li>
          <li>
            <strong>How it travels.</strong> Each one is encrypted for your device and handed to
            your browser&rsquo;s push service (Google, Mozilla, Apple or Microsoft, depending on
            your browser), which delivers it but cannot read it.
          </li>
          <li>
            You can switch each kind off, or remove a device, in Settings. A device the push service
            no longer knows is removed, and all of them go when you delete your account.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    body: (
      <>
        <p>
          If you add a webhook (for your own items, or as a team&rsquo;s admin for the
          team&rsquo;s), we send what happens to those items to the address you choose: any HTTPS
          address, a Slack channel or a Microsoft Teams channel. Each message holds the item&rsquo;s
          name and link, who did it, and a short detail, such as the opening words of a comment.
          What happens to it there is governed by that service&rsquo;s own terms and privacy policy.
        </p>
        <p>
          We keep each webhook&rsquo;s name, the events it hears, and its address and signing secret
          (both encrypted), with its last 20 deliveries (the event, when, and the answer that came
          back). Your own webhooks are deleted with your account; a team&rsquo;s are paused when the
          person who added it stops being one of its admins.
        </p>
      </>
    ),
  },
  {
    id: 'downloading-your-data',
    title: 'Downloading your data',
    body: (
      <p>
        If you have an account, you can download everything you own, in every app, as one file: your
        documents, a picture of each tab, the comments you wrote in them, your profile and the
        images you uploaded. A team&rsquo;s admins can do the same for the team&rsquo;s documents.
        The file is built on our servers and kept in Cloudflare object storage until its link
        lapses, 3 days after it is ready, when it is deleted. The link only works while you are
        signed in as the account it was made for.
      </p>
    ),
  },
  {
    id: 'service-providers',
    title: 'Service providers',
    body: (
      <>
        <ul>
          <li>
            <strong>Cloudflare</strong>: hosting, databases, image storage, Turnstile on the sign-in
            pages, delivering every email we send, sign-in codes included, and relaying
            livehuddle&rsquo;s calls.
          </li>
          <li>
            <strong>Google</strong>: sign-in with Google, if you choose it, and showing your Google
            picture, if you have one.
          </li>
          <li>
            <strong>Your browser&rsquo;s push service</strong> (Google, Mozilla, Apple or
            Microsoft): delivering phone notifications, encrypted, if you turn them on.
          </li>
        </ul>
        <p>
          The editors load fonts from <strong>Google Fonts</strong>, and an embedded video, link
          card or website loads from its provider, which sees the viewer&rsquo;s IP address. Link
          previews are fetched by our server. A webhook goes where you point it. An app that uses
          anyone else says so in its section below.
        </p>
      </>
    ),
  },
  {
    id: 'sharing-and-visibility',
    title: 'Sharing and visibility',
    body: (
      <p>
        Anything in a document you share is visible to people with the link. You can protect a link
        with a password or an expiry, and revoking a link stops further access through it.
      </p>
    ),
  },
  {
    id: 'keeping-and-deleting-your-data',
    title: 'Keeping and deleting your data',
    body: (
      <>
        <p>
          You can delete any document you own at any time. It waits in the Trash for 30 days so you
          can restore it, and is then removed for good. A document left empty and untouched for 30
          days moves to the Trash on its own.
        </p>
        <p>
          You can delete your account yourself from <strong>Settings</strong>, then{' '}
          <strong>Account</strong>, then <strong>Delete Account</strong>, in any app, with a code we
          email you to confirm it. Your liveworkspace account closes, for every app at once: the
          documents you own in every app (the Trash included), your folders, favourites, images and
          preferences, your account details and Google picture address, sessions, API tokens,
          sign-in records, phone notification devices and your own webhooks are deleted straight
          away. We also disconnect your Google Drive and delete any download of your data at the
          same time; if either fails, the Drive access ends when you remove it in your Google
          account, and a download is deleted by itself after 3 days. You leave every team (a team
          you ran alone goes; one you were the only admin of passes to its longest-standing member).
          Documents that belong to a team stay with the team.
        </p>
        <p>
          Other things are kept only as long as they are useful: anonymous product events for 60
          days, and changes made by connected AI tools for 30 days, so they can be undone. A
          guest&rsquo;s documents have no account to delete: remove them in the Explorer, or ask us.
          A guest id that no app has been handed for 400 days can&rsquo;t be used again, so its
          preferences, display name and colour are then deleted; its documents stay.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Every request is checked for authentication and access. If you find a security
        vulnerability, please report it to us privately through{' '}
        <a href={SECURITY_ADVISORY_URL}>GitHub&rsquo;s private advisory form</a>, not the contact
        form or a public issue.
      </p>
    ),
  },
  {
    id: 'google-drive',
    title: 'Google Drive',
    body: (
      <>
        <p>
          If you connect Google Drive in Cloud Sync, liveworkspace asks Google for access to{' '}
          <strong>only the files it creates, or that you open with it</strong> (the{' '}
          <code>drive.file</code> scope), and to appear in Drive&rsquo;s Open with menu (
          <code>drive.install</code>). It cannot see any other file in your Drive.
        </p>
        <ul>
          <li>
            Our Drive service keeps a copy of your own work, from every app, in those files, and
            brings renames, moves and deletions you make in Drive back to your work. It runs on our
            servers, so it keeps up whether or not you have a tab open.
          </li>
          <li>
            We store an encrypted refresh token, the id of the Google account you connected, the ids
            of the files and folders liveworkspace created, and the state it last wrote to them.
          </li>
          <li>
            We use Google user data only to provide the sync you asked for. We do not use it for
            advertising, sell it or use it to train AI models, and nobody reads it unless you ask us
            to for support, it is needed for security, or the law requires it.
          </li>
          <li>
            Disconnecting, or deleting your account, revokes access at Google and deletes what we
            stored. Your files stay in your Drive.
          </li>
        </ul>
        <p>
          liveworkspace&rsquo;s use and transfer of information received from Google APIs adheres to
          the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>The apps are not directed at children, and we do not knowingly collect data from them.</p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: (
      <p>
        We may update this policy from time to time. The date at the top shows the latest version.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        For privacy questions or requests, reach us through our{' '}
        <a href={CONTACT_URL}>contact form</a>.
      </p>
    ),
  },

  // App by app: only what one app does beyond the above (each signs you in with your liveworkspace account).
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
        <a href="#what-the-apps-store">What the apps store</a>. It handles your data in no way of
        its own.
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

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      path="/privacy"
      updated={LEGAL_UPDATED}
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
      intro={
        <p>
          liveworkspace is a family of apps built to need as little of your data as possible. This
          policy covers all of them, and the one account you sign in with. What every app does is
          said once; what only one app does is under <a href="#app-by-app">App by app</a>. It sits
          alongside our <a href="/terms">Terms of Use</a>.
        </p>
      }
    />
  );
}
