# The org chart

## What

An **Org chart** is a [mind map](mind-node.md) in the **Downward** flow whose nodes are **person nodes**: each draws an
initials disc, the person's name and their role, like a person [Card](card.md). It is not a new kind: a person node is
a mind node with `mindLook: 'person'`, so everything a mind map does (Tab for a report, Enter for a peer, Tidy Map,
moving a branch with its subtree, Edit Outline, the flows) works on an org chart as it is.

## Why

Org charts, service ownership trees and component hierarchies are trees of people or things with a name and a role.
Drawn as a mind map they lose the role line and read as a brainstorm; drawn from cards they lose the tree (no Tab for
a report, no tidy layout, no carrying a branch). The mind map already has a downward flow "for an org chart"; it was
missing the look.

## A person node

- **Name** is the node's label, bold, at the node's own text size; double-click edits it as any label.
- **Role** is the meta line (`pageSubtitle`), muted, under the name; it edits in place once the node is selected,
  placeholder "Role". Empty, the name centres vertically.
- **Initials** are drawn in a soft accent disc at the left: the first letters of the name's first two words ("Ana
  Kim" is "AK"), upper-cased; a one-word name gives its first two letters; no name gives "?".
- **Size**: 220 × 64 by default; the disc is 70% of the node's height (at most 44 px).

## Growing

- A node grown from a person node (Tab or Enter), or from anywhere in a map whose root is a person node, is a person
  node too: the look is the map's. Its role starts empty.
- Its connector is drawn as an **elbow bracket** in every finish: each report hangs off one trunk under its manager,
  the way the Professional finish draws any mind map ([Mind node](mind-node.md) "Connectors"). A connector given a
  style of its own keeps it.

## Placing one

The palette's **Org Chart** tile (Build, after Mind Node) drops a person root in the Downward flow, "Ana Kim" / "Head
of Engineering". Tab from it adds the first report.

## Animation

Person nodes take the Shape set and the Text set like any mind node. A level-by-level build is not part of this
element; a map's nodes animate one by one as any element does.

## Element tour

The first time an Editor selects a person node, a small **Tour** toolbar beside its selection toolbar offers the
[Org Chart tour](../007-editor/element-tours.md#the-org-chart-tour): the name, role and initials, a report (Tab) and a
peer (Enter), a team moved as one, and the menu it shares with mind maps.

## Share roles

As a mind node's ([Mind node](mind-node.md)): an Editor grows and edits; a Participant writes a node's text only where
a mind node allows it; a Viewer looks. The role line edits only for an Editor.

## Agents

The MCP server and the REST API take a mind node with `mindLook: 'person'` and `pageSubtitle`; an agent drawing an org
chart lays out mind nodes with `mindParentId` and the Downward flow on the root.
