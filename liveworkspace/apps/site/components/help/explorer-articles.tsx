import type { HelpSection } from './HelpArticle';

// The Explorer's articles on liveworkspace.app (liveworkspace/docs/specs/010-site/site.md "Help"), by slug: the Explorer
// in no app, where one library holds every app's work. Each app's help centre has articles for its own Explorer
// (livediagram, liveplanner, livedocuments, livedesign, livehuddle); these speak of files and apps, as the page does.
// Names and addresses are in lib/help/platform-help.ts, which the Explorer itself loads; this file is the text.

type Content = { lede: string; sections: HelpSection[] };

const OVERVIEW: Content = {
  lede: 'One library for the work you make in every liveworkspace app. Choose an app at the top of a page to see only its work, or All Apps to see everything together.',
  sections: [
    {
      id: 'home',
      title: 'Home',
      body: (
        <>
          <p>
            <strong>Home</strong> is the page the Explorer opens on, and the first row of its
            sidebar. It answers the question you bring back with you: what was I working on? Under a
            greeting it shows your newest files, the ones you use most and last, your spaces, and
            what was shared with you recently. A section with nothing in it is left out.
          </p>
          <p>
            The search field sits in the greeting, with <strong>New</strong> beside it: a menu of
            every app&apos;s kind of file, each with its logo. On your first visit, with nothing
            made yet, Home offers ways to start instead, and as a guest an{' '}
            <strong>Already Have Work?</strong> card that signs you in so your files come back.
          </p>
        </>
      ),
    },
    {
      id: 'my-work',
      title: 'My Work',
      body: (
        <>
          <p>
            <strong>My Work</strong> is your own library: everything you made, from every app. It
            lists its <a href="/help/explorer/folders">folders</a> first, then every file that is
            not in a folder. A new file lands there unless you made it inside a folder, so it always
            has an obvious home.
          </p>
          <p>
            A file lives in exactly one place, My Work or a <a href="/help/explorer/teams">team</a>.
            Everything else in the sidebar is a view that gathers files from wherever they live.
            Switch between <strong>List</strong>, <strong>Card</strong> and details views with the
            buttons at the top right of a page.
          </p>
        </>
      ),
    },
    {
      id: 'recent',
      title: 'Recent',
      body: (
        <p>
          <strong>Recent</strong> lists what you opened most lately, newest first, from every
          folder, team and share. It goes by when <strong>you</strong> last opened something, and
          nobody else sees it. It is a view, not a folder: a file in Recent has not moved. To keep
          one out, choose <strong>Hide from Recent</strong> in its <strong>⋯</strong> menu; it stays
          everywhere else.
        </p>
      ),
    },
    {
      id: 'shared-with-me',
      title: 'Shared With Me',
      body: (
        <p>
          Open a share link someone sent you and the file is remembered under{' '}
          <strong>Shared With Me</strong>, with its owner and the role the link gives you (
          <strong>Edit</strong>, <strong>Participate</strong> or <strong>View</strong>). It works
          without an account, kept for your guest identity, and signing in carries it into your
          account. Removing a row only takes it off your list. See{' '}
          <a href="/help/explorer/sharing">Sharing Across Apps</a>.
        </p>
      ),
    },
    {
      id: 'inbox',
      title: 'Inbox',
      body: (
        <p>
          The <strong>Inbox</strong> lists what is still open for you, across every app: actions
          waiting on you, actions you gave to someone else, and comment threads nobody has resolved.
          Each row names its file and its app. Click one to read it beside the list, reply, resolve
          a thread or mark an action done, and use <strong>Open</strong> to land at that spot in the
          app. When nothing waits, it says <strong>You&apos;re all caught up</strong>.
        </p>
      ),
    },
    {
      id: 'trash',
      title: 'Trash',
      body: (
        <p>
          A deleted file waits in the <strong>Trash</strong> for 30 days, then goes for good. The
          Trash is shared by every app, and it also holds deleted files of the teams you belong to.
          <strong> Restore</strong> puts a file back exactly where it was, with its tabs, comments
          and share links; <strong>Delete Forever</strong> and <strong>Empty Trash</strong> remove
          it now and ask you to confirm first.
        </p>
      ),
    },
    {
      id: 'search',
      title: 'Search and filters',
      body: (
        <>
          <p>
            Type in the search field at the top of any page. Words match a file&apos;s name or its
            folder&apos;s, ignoring capitals; with several words, a file has to match all of them.
            In My Work, a folder or a team the search stays inside that place and reaches into every
            folder below it. On Home, the Inbox and the Trash, typing opens{' '}
            <strong>Search results</strong>: every file you can open.
          </p>
          <p>
            The chips under a page&apos;s title narrow the same search: <strong>Opens in</strong>{' '}
            (which app), <strong>Made by AI</strong>, <strong>Edited</strong> (today, 7 or 30 days,
            12 months, this year) and <strong>People</strong> (yours or others&apos;). Search also
            finds Settings sections and these help articles.
          </p>
        </>
      ),
    },
  ],
};

const FOLDERS: Content = {
  lede: 'Folders organise a growing library. They belong to your liveworkspace account, not to one app, so one folder can hold a diagram, a plan, a document and a design together.',
  sections: [
    {
      id: 'how-folders-work',
      title: 'How folders work',
      body: (
        <>
          <p>
            Every file lives in exactly one folder, or in none (at the root of its space), and
            folders nest inside other folders. A team has folders of its own that work the same way
            (<a href="/help/explorer/teams">Teams</a>).
          </p>
          <p>
            Choose <strong>All Apps</strong> at the top of the page to see everything a folder
            holds. With one app chosen, only that app&apos;s files are listed; the folder still
            holds the others.
          </p>
        </>
      ),
    },
    {
      id: 'creating',
      title: 'Creating a folder',
      body: (
        <>
          <p>
            Open <strong>My Work</strong> or a folder and use <strong>Create</strong> at the top
            right: <strong>New Folder</strong> adds a folder at the top level of My Work, and inside
            a folder the same entry reads <strong>New Subfolder</strong>. A folder&apos;s own menu
            offers <strong>New Subfolder</strong> too, including from the sidebar.
          </p>
          <p>
            A new folder starts named <strong>New Folder</strong> with its name ready to type over:
            type a name and press <code>Enter</code>. Your folder tree shows under{' '}
            <strong>My Work</strong> in the sidebar. To have each kind of new file filed
            automatically, use <strong>Use as Default for…</strong> in a folder&apos;s menu.
          </p>
        </>
      ),
    },
    {
      id: 'folder-menu',
      title: 'Renaming, moving and deleting',
      body: (
        <>
          <p>
            Each folder has a menu (its <strong>⋯</strong> button, a right-click, or{' '}
            <strong>Shift+F10</strong> in the sidebar) with <strong>Open</strong>,{' '}
            <strong>Rename</strong>, <strong>New Subfolder</strong>, <strong>Move Folder</strong>{' '}
            (the folder and everything in it), <strong>Use as Default for…</strong> and{' '}
            <strong>Delete Folder</strong>.
          </p>
          <p>
            Deleting a folder asks you to confirm, and it does not delete what is inside: the files
            and subfolders directly in it move up a level, into the folder it sat in or the root of
            its space.
          </p>
        </>
      ),
    },
    {
      id: 'telling-apart',
      title: 'Telling folders apart',
      body: (
        <p>
          In the card view a folder shows a small mosaic of what is inside it, so two similarly
          named folders are apart at a glance. An empty folder keeps the plain folder glyph, and a
          default folder carries a small mark after its name. Keep the tree shallow at first: a
          handful of top-level folders by project or client is easier to scan than deep nesting.
        </p>
      ),
    },
  ],
};

const TEAMS: Content = {
  lede: 'A team is a space of its own in the Explorer: a library and folders that every member can use, for work from every app.',
  sections: [
    {
      id: 'your-teams',
      title: 'Your teams',
      body: (
        <>
          <p>
            Each team you belong to is a row under <strong>Spaces</strong> in the sidebar, right
            after <strong>My Work</strong>. Click it to open its library, or expand it with the
            arrow to walk its folders and click one to open it.
          </p>
          <p>
            A team&apos;s library holds its folders and files from every app, and every member can
            manage them. At the top of the team&apos;s page sits its card, where the team is run in
            place: who has joined and who is invited, each member with their role, an invite link,
            and the <strong>⋯</strong> menu (<strong>Edit Team</strong>, <strong>Leave Team</strong>
            , <strong>Delete Team</strong>, as your role allows). On a team&apos;s library,{' '}
            <strong>Create</strong> offers each app&apos;s kind and <strong>New Folder</strong>, and
            what you make lands in the team.
          </p>
        </>
      ),
    },
    {
      id: 'new-team',
      title: 'New Team',
      body: (
        <p>
          Teams belong to your account, so a team is the same in every app. The <strong>+</strong>{' '}
          at the right of the <strong>Spaces</strong> heading makes one: give it a name and, if you
          like, an organisation, and the new team opens. You can also pick the{' '}
          <strong>New Team</strong> tile when you move a file, and it goes straight in. Admins
          rename, staff and delete a team from its card, and invite people by email as a Member or
          an Admin.
        </p>
      ),
    },
    {
      id: 'invites',
      title: 'Invites',
      body: (
        <p>
          When someone invites you to a team, <strong>Invites</strong> appears in Spaces with the
          number waiting. Open it to see each invitation: the team, who invited you and when, and
          the role offered. <strong>Accept</strong> opens the team, and <strong>Decline</strong>{' '}
          takes the invitation away.
        </p>
      ),
    },
    {
      id: 'signed-in-only',
      title: 'Signed in only',
      body: (
        <p>
          Teams need an account, so team rows and <strong>New Team</strong> appear only when you are
          signed in. A guest sees a <strong>Sign In to Use Teams</strong> card under Spaces instead,
          and the files made as a guest come with them when they sign in (
          <a href="/help/explorer/signing-in">Guest or Account</a>).
        </p>
      ),
    },
  ],
};

const MOVING: Content = {
  lede: 'A file lives in one place at a time: My Work or a team, in a folder or at its root. Moving it changes where it lives, and nothing else about it.',
  sections: [
    {
      id: 'change-folder',
      title: 'Change Folder',
      body: (
        <p>
          Open a file&apos;s menu (its <strong>⋯</strong> button or a right-click) and choose{' '}
          <strong>Change Folder</strong>. The picker opens on your spaces: pick{' '}
          <strong>My Work</strong> or a team first, then click into the folder you want. A{' '}
          <strong>New Folder</strong> entry at the foot makes one on the spot (and{' '}
          <strong>New Team</strong> a team), then press <strong>Move Here</strong>.
        </p>
      ),
    },
    {
      id: 'dragging',
      title: 'Dragging',
      body: (
        <>
          <p>
            Drag a file&apos;s row or card onto a folder in the sidebar or the list, onto{' '}
            <strong>My Work</strong> to put it back at the root, or onto a team to move it there.
            Rest it on a closed folder in the sidebar for a moment and the folder opens, so you can
            drop into a subfolder. Folders themselves move with <strong>Move Folder</strong>, not by
            dragging.
          </p>
          <p>
            A note says where the file went, with an <strong>Undo</strong>.
          </p>
        </>
      ),
    },
    {
      id: 'into-a-team',
      title: 'Between you and a team',
      body: (
        <>
          <p>
            Moving a file into a team makes it the team&apos;s: every member can open and manage it
            there, so move it only when you mean to share it with them. Moving it back to{' '}
            <strong>My Work</strong> returns it to you.
          </p>
          <p>
            If you sync to Google Drive, a file in a team leaves your Drive copy (it goes to
            Drive&apos;s bin) and returns when you move it back out.
          </p>
        </>
      ),
    },
    {
      id: 'create-in-place',
      title: 'Creating in place',
      body: (
        <p>
          The simplest move is none. Open the folder or team first, then press{' '}
          <strong>Create</strong>: the new file lands inside it. A folder you set with{' '}
          <strong>Use as Default for…</strong> takes new files of that kind wherever you create
          them.
        </p>
      ),
    },
  ],
};

const SHARING: Content = {
  lede: 'Sharing works the same in every app: a link that opens the file in the app that made it, with the access you chose.',
  sections: [
    {
      id: 'share-dialog',
      title: 'Share a file',
      body: (
        <>
          <p>
            Choose <strong>Share</strong> in a file&apos;s menu, in the Explorer or in its app. The
            Share dialog makes a link for the file and lets you pick what it allows, how long it
            lasts, whether a password guards it, and, where the app offers it, a single tab. Anyone
            with a link can open it; you do not need an account to make one.
          </p>
          <p>
            Each link gives one role: <strong>Editor</strong> changes anything,{' '}
            <strong>Participant</strong> comments and joins in, and <strong>Viewer</strong> reads.
            You can turn a link off at any time, and links can be set to run out. The Share
            dialog&apos;s own <strong>Help</strong> opens the article for that file&apos;s app,
            which says what each role can do there.
          </p>
        </>
      ),
    },
    {
      id: 'shared-with-me',
      title: 'What others shared with you',
      body: (
        <p>
          Open a link someone sent you and the file is added to <strong>Shared With Me</strong>,
          from any app, with its owner and your role. Click a row to reopen it without hunting for
          the link; the <strong>×</strong> (<strong>Dismiss</strong>) takes it off your list and
          touches nothing else. A file whose link was turned off, has run out, or went to the Trash
          drops off the list.
        </p>
      ),
    },
    {
      id: 'across-apps',
      title: 'Across apps',
      body: (
        <>
          <p>
            Sharing belongs to the file, not to the folder: a folder or a team can hold files from
            every app, and each is shared on its own link in its own app. A link opens the file
            wherever it is filed.
          </p>
          <p>
            People you share with need an account only to keep files of their own, join a team or
            publish to the Community. A guest can open a link, edit when it allows it, and the file
            stays on their list under their guest identity.
          </p>
        </>
      ),
    },
    {
      id: 'teams-instead',
      title: 'Sharing with a team instead',
      body: (
        <p>
          For people you work with all the time, a <a href="/help/explorer/teams">team</a> is
          simpler than links: move the file into the team&apos;s library, and every member can open
          and manage it, from every app. Use a link for people outside the team, or for one-off
          sharing.
        </p>
      ),
    },
  ],
};

const SIGNING_IN: Content = {
  lede: 'You can start in any app without signing in. An account adds the parts that need an identity, and nothing you made as a guest is lost when you sign in.',
  sections: [
    {
      id: 'as-a-guest',
      title: 'As a guest',
      body: (
        <>
          <p>
            A guest has the full editing experience and a library of their own in the Explorer. Your
            work is saved against your browser, with the same guest identity in every app, so it is
            there when you come back on the same device. You can share, open share links and
            collaborate in real time.
          </p>
          <p>
            The one trade-off: a guest library lives in one browser. Clearing the browser&apos;s
            data, or switching to another device, means it does not follow you.
          </p>
        </>
      ),
    },
    {
      id: 'with-an-account',
      title: 'With an account',
      body: (
        <>
          <p>An account is free, and adds:</p>
          <ul>
            <li>
              <strong>Sync across devices:</strong> your files travel with you, from every app.
            </li>
            <li>
              <strong>Teams</strong>, with their shared libraries and invites.
            </li>
            <li>
              <strong>A name</strong> collaborators see, from your profile.
            </li>
            <li>
              <strong>Google Drive sync</strong> (<a href="/help/google-drive">how it works</a>),
              API tokens, notifications and publishing to the Community.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'sign-in-reminder',
      title: 'The sign-in reminder',
      body: (
        <>
          <p>
            While you work as a guest, a card at the foot of the Explorer reminds you an account is
            there, with a line on what it brings. <strong>Sign in</strong> takes you to the sign-in
            page and back to where you were. <strong>Learn more</strong> opens a short list of what
            an account adds, with its own <strong>Sign in</strong> and a{' '}
            <strong>Maybe later</strong> that closes it. The <strong>×</strong> dismisses the card,
            and it does not come back in this browser. It never appears once you are signed in.
          </p>
          <p>It is only a reminder: nothing stops working if you ignore it.</p>
        </>
      ),
    },
    {
      id: 'moving-over',
      title: 'Moving from guest to account',
      body: (
        <p>
          When you sign in or sign up in the same browser, what you kept as a guest moves into your
          account: your files and folders, shape libraries and images. Files kept only in{' '}
          <strong>Offline</strong> stay there until you choose to move them: after you sign in, a
          list of them lets you tick the ones to move, or press <strong>Not Now</strong> to leave
          them.
        </p>
      ),
    },
  ],
};

export const EXPLORER_CONTENT: Record<string, Content> = {
  '': OVERVIEW,
  folders: FOLDERS,
  teams: TEAMS,
  moving: MOVING,
  sharing: SHARING,
  'signing-in': SIGNING_IN,
};
