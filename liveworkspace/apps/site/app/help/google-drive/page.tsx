import type { Metadata } from 'next';
import { HelpArticle, type HelpSection } from '@/components/help/HelpArticle';

// Google Drive sync, the platform's one help article (liveworkspace/docs/specs/010-site/site.md "Help", liveworkspace/docs/specs/005-drive/drive.md):
// the mirror is liveworkspace's, the same for every app, so it is explained once here. Each app's help keeps a short
// Google Drive article that points to this page, and Settings › Profile › Cloud Sync links here.

const HEADING = 'Google Drive sync';
const TITLE = `${HEADING} · liveworkspace`;
const DESCRIPTION =
  'Keep a copy of your work from every liveworkspace app in your own Google Drive, in matching folders, with renames, moves and deletions synced both ways.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/help/google-drive' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/help/google-drive',
    siteName: 'liveworkspace',
    type: 'article',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

const SECTIONS: HelpSection[] = [
  {
    id: 'connecting',
    title: 'Connecting',
    body: (
      <>
        <p>
          Google Drive sync is for signed-in accounts. Open <strong>Settings</strong>, then{' '}
          <strong>Account</strong>, and find <strong>Google Drive</strong> under{' '}
          <strong>Cloud Sync</strong>. It is the same in every app and on liveworkspace.app, and
          connecting once covers them all. Choose <strong>Connect</strong>: Google asks you to let
          liveworkspace create files in your Drive and appear in its <strong>Open with</strong>{' '}
          menu, then brings you back to Cloud Sync.
        </p>
        <p>
          <strong>liveworkspace only sees files it created, or a file you open with it.</strong>{' '}
          Google gives it no view of the rest of your Drive.
        </p>
        <p>
          The first time, liveworkspace makes a folder called <strong>liveworkspace</strong> and
          copies your work into it, oldest first, in folders that match yours, each item a file
          named after it with its app&apos;s extension (<code>.livediagram</code>,{' '}
          <code>.liveplanner</code>, <code>.livedocuments</code>, <code>.livedesign</code>,{' '}
          <code>.livehuddle</code>) and a picture of it as the thumbnail. Cloud Sync shows the
          progress, and the copy carries on if you close the tab. You may rename or move the folder
          in Drive; liveworkspace keeps using it.
        </p>
      </>
    ),
  },
  {
    id: 'what-is-synced',
    title: 'What is synced',
    body: (
      <>
        <p>
          Everything you own outside a team, from every app, in your own folders. Not synced: items
          in a team, items others shared with you, and anything kept only in this browser (Offline
          and Offline). Move an item into a team and its file goes to Drive&apos;s bin; move it back
          out and the file returns.
        </p>
        <p>
          The copy in Drive is a mirror. Your work still lives in liveworkspace, so sharing,
          realtime editing and history work exactly as before.
        </p>
      </>
    ),
  },
  {
    id: 'both-ways',
    title: 'What travels which way',
    body: (
      <>
        <p>
          An item&apos;s contents go one way, from liveworkspace to Drive. Names, folders and the
          bin go both ways.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">In liveworkspace</th>
              <th scope="col">In Google Drive</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Create, edit or rename an item</td>
              <td>The file is created, updated or renamed</td>
            </tr>
            <tr>
              <td>Move an item to another folder</td>
              <td>The file moves</td>
            </tr>
            <tr>
              <td>Move an item to the Trash</td>
              <td>The file moves to Drive&apos;s bin</td>
            </tr>
            <tr>
              <td>Restore an item from the Trash</td>
              <td>The file comes back from the bin</td>
            </tr>
            <tr>
              <td>Delete an item for good</td>
              <td>The file stays in Drive&apos;s bin, which empties it after 30 days</td>
            </tr>
            <tr>
              <td>Create, rename, move or delete a folder</td>
              <td>The Drive folder follows</td>
            </tr>
          </tbody>
        </table>
        <p>
          It works the other way too: <strong>rename</strong> a file in Drive, <strong>move</strong>{' '}
          it to another folder in the liveworkspace tree, or move it to the <strong>bin</strong>,
          and the item follows. Restoring it from Drive&apos;s bin restores the item; deleting it
          for good from Drive deletes it only if it is already in your Trash. Folders follow the
          same way. Edits to a file&apos;s contents made in Drive are not taken in: liveworkspace
          writes its copy again on the next sync.
        </p>
      </>
    ),
  },
  {
    id: 'how-often',
    title: 'How often it syncs',
    body: (
      <>
        <p>
          Syncing is automatic, and it runs on liveworkspace&apos;s servers, so it keeps up whether
          or not you have a tab open. There is nothing to press.
        </p>
        <ul>
          <li>
            A change you make is synced about half a minute after you stop, so a burst of edits is
            one sync.
          </li>
          <li>
            An item&apos;s contents are written at most once every 5 minutes, so a long editing
            session writes to Drive a few times rather than on every change. Renames, moves and the
            bin are never held back.
          </li>
          <li>
            Google tells liveworkspace when your Drive changes, and a change there follows about
            half a minute later. A slower check every so often catches anything missed.
          </li>
          <li>Opening Cloud Sync checks straight away.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'seeing-how-it-is-doing',
    title: 'Seeing how it is doing',
    body: (
      <>
        <p>
          The Google Drive row in Cloud Sync says where it stands: <strong>Last synced</strong> a
          while ago (or <strong>Not synced yet</strong>), <strong>Syncing…</strong>, or{' '}
          <strong>Copying 3 of 12…</strong> during the first copy. Under the row, it names the Drive
          folder your work is synced to. When something needs you, the status turns amber with a
          warning sign (<strong>Needs reconnecting</strong>, <strong>Needs attention</strong> or{' '}
          <strong>Offline</strong>) and a second line says what happened, with the button to fix it.
        </p>
        <p>In the Explorer, each item you own carries a small cloud by its Updated time:</p>
        <ul>
          <li>
            <strong>Synced</strong>, a tick: Drive has its latest version.
          </li>
          <li>
            <strong>Waiting</strong>, an arrow: it will be copied on the next sync.
          </li>
          <li>
            <strong>Syncing</strong>, turning arrows: it is being copied now.
          </li>
          <li>
            <strong>Failed</strong>, an exclamation mark: it couldn&apos;t be copied, and is tried
            again automatically.
          </li>
        </ul>
        <p>
          A small locked folder beside an item&apos;s name means its file sits in a Drive folder
          liveworkspace can&apos;t see (below).
        </p>
      </>
    ),
  },
  {
    id: 'folders-liveworkspace-cant-see',
    title: 'Folders liveworkspace can’t see',
    body: (
      <>
        <p>
          A folder you make in Google Drive itself is invisible to liveworkspace until you show it
          one. If you move an item&apos;s file into such a folder, the item moves to the root of
          your work here, and Cloud Sync and the item&apos;s Explorer row say so. The file stays
          where you put it in Drive. The notice clears as soon as the item moves again, from either
          side: move the file into one of the folders liveworkspace made, or move the item into a
          folder here.
        </p>
        <p>
          Folders you make in liveworkspace always appear in Drive, so building your tree here needs
          no extra step.
        </p>
      </>
    ),
  },
  {
    id: 'opening-from-drive',
    title: 'Opening a file from Drive',
    body: (
      <>
        <p>
          Right-click a file in Google Drive and choose <strong>Open with</strong>, then{' '}
          <strong>liveworkspace</strong>. Your own item opens in its app straight away. A copy you
          made in Drive, a file someone shared with you, or one from another liveworkspace is
          offered as <strong>Import as a copy</strong>, which makes a new item of your own from it
          and opens it. Copies made in Drive are never picked up on their own: Google keeps them
          hidden from liveworkspace until you open one this way.
        </p>
        <p>
          If you are signed out, you sign in first. If liveworkspace has no access to Drive yet,
          choose <strong>Allow access</strong>: it connects Drive and comes back to the same file.
        </p>
      </>
    ),
  },
  {
    id: 'needs-attention',
    title: 'When Cloud Sync needs attention',
    body: (
      <ul>
        <li>
          <strong>Offline.</strong> Google Drive can&apos;t be reached just now. liveworkspace tries
          again by itself.
        </li>
        <li>
          <strong>Needs reconnecting.</strong> Google stopped accepting liveworkspace&apos;s access:
          you removed it from your Google account, or Google expired it. Syncing pauses and{' '}
          <strong>nothing is deleted</strong>, here or in Drive. Choose <strong>Reconnect</strong>{' '}
          (in Cloud Sync, or on the banner in the Explorer) and sync carries on.
        </li>
        <li>
          <strong>Needs attention.</strong> An item moved in Drive into a folder liveworkspace
          can&apos;t see. Move it into one of your liveworkspace folders, in Drive or here, and the
          notice clears.
        </li>
      </ul>
    ),
  },
  {
    id: 'switching-google-account',
    title: 'Switching Google account',
    body: (
      <p>
        If you reconnect with a different Google account, nothing changes until you choose.{' '}
        <strong>Switch Google Account?</strong> asks first: <strong>Switch Account</strong> moves
        Cloud Sync to the new account and starts a fresh copy in its Drive, and the files already in
        the other account&apos;s Drive stay there untouched. <strong>Keep Current Account</strong>{' '}
        leaves everything as it was. The question waits 30 minutes; after that, connect again.
      </p>
    ),
  },
  {
    id: 'disconnecting',
    title: 'Disconnecting',
    body: (
      <>
        <p>
          Choose <strong>Disconnect</strong> in Cloud Sync. liveworkspace stops updating Drive and
          forgets its access; <strong>your files stay in Drive</strong>. Connect again later and
          liveworkspace finds the same folder rather than making a second one.
        </p>
        <p>
          Deleting your liveworkspace account disconnects Drive the same way, and the files in your
          Drive stay yours.
        </p>
      </>
    ),
  },
];

export default function GoogleDriveHelpPage() {
  return (
    <HelpArticle
      heading={HEADING}
      lede="Keep a copy of your work, from every app, in your own Google Drive: each item a file in folders that match yours, kept in step as you work."
      sections={SECTIONS}
    />
  );
}
