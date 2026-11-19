# Approvals

Status: built (Work Tracker 937)

Asking named people to approve a canvas, their **Approve** or **Request Changes**, the badge (Awaiting n of m,
Changes Requested, Approved, Changed Since Approval), the email and the History rows are the platform's, the same in
every app: [liveworkspace approvals](../../../../liveworkspace/docs/specs/004-index/approvals.md). This file says only
what is livediagram's.

## Where it sits

- **Request Approval** is the Share dialog's **Approval** tab, beside Passes and Community, for an Editor of the whole
  canvas stored on the server (never in This Browser, an embed, the workbench frame or through a link confined to
  one tab). Its approvers are the team's members (the same read as mentions and assignments), then the canvas's
  owner and its link visitors.
- **Save this version as a snapshot** is offered there whenever Snapshots are ([snapshots.md](snapshots.md)): the
  snapshot is taken first, named "Sent for approval", and the request points at it.
- **The badge** is the first thing in the corner card at the top right (with Copy, Share and the account); it opens
  the Share dialog on the Approval tab for an Editor of the whole canvas. On a phone, and wherever the card drops
  its names, it shows its glyph alone.
- **The banner** is a strip across the top of the editor, above the floating chrome, for a signed-in, named approver of the open request, whatever their level.

## Share roles

As the platform's table, with this app's levels ([share-roles.md](share-roles.md)): an Editor of the whole canvas
asks and cancels; any named approver (Editor, Participant or Viewer) decides, the one write a Viewer has; a guest, a
Community visitor, an embed and the workbench frame see nothing. The api holds no approval: every route is the index's.

## The email

"<Requester> asked you to approve <canvas name>", sent by the api when the index tells it of a request
(`approval_requested`), to each approver whose **Actions Assigned to Me** emails are on, with the note, the due day
and a button that opens the canvas.
