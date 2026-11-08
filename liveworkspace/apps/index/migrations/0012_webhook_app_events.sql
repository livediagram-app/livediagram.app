-- Webhooks per app (liveworkspace/docs/specs/004-index/webhooks.md "What it sends"): a webhook subscribes to an app's
-- event (`livediagram:shared`), never a bare event across every app. Every row written before held bare events
-- (`,created,shared,card_moved,`), each meaning that event from every app that sends it: this rewrites each as its
-- pairs, the nine item, comment, action and mention events as all five apps' and `card_moved` and `form_response` as
-- liveplanner's. Nothing else changes; the index still reads a bare event that way, so a row this missed can't break.
--
-- Each REPLACE swaps one comma-wrapped event for its comma-wrapped pairs, so the next event in the row keeps its
-- leading comma. No event's name is another's with a comma before it (`,moved,` is not in `,card_moved,`), and a
-- row holds each event once, so the order of the REPLACEs doesn't matter. A row with a `:` is already in pairs.

UPDATE webhooks SET events = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(events, ',created,', ',livediagram:created,liveplanner:created,livedocuments:created,livedesign:created,livehuddle:created,'), ',renamed,', ',livediagram:renamed,liveplanner:renamed,livedocuments:renamed,livedesign:renamed,livehuddle:renamed,'), ',moved,', ',livediagram:moved,liveplanner:moved,livedocuments:moved,livedesign:moved,livehuddle:moved,'), ',trashed,', ',livediagram:trashed,liveplanner:trashed,livedocuments:trashed,livedesign:trashed,livehuddle:trashed,'), ',shared,', ',livediagram:shared,liveplanner:shared,livedocuments:shared,livedesign:shared,livehuddle:shared,'), ',commented,', ',livediagram:commented,liveplanner:commented,livedocuments:commented,livedesign:commented,livehuddle:commented,'), ',action_assigned,', ',livediagram:action_assigned,liveplanner:action_assigned,livedocuments:action_assigned,livedesign:action_assigned,livehuddle:action_assigned,'), ',action_done,', ',livediagram:action_done,liveplanner:action_done,livedocuments:action_done,livedesign:action_done,livehuddle:action_done,'), ',card_moved,', ',liveplanner:card_moved,'), ',form_response,', ',liveplanner:form_response,'), ',mention,', ',livediagram:mention,liveplanner:mention,livedocuments:mention,livedesign:mention,livehuddle:mention,')
WHERE instr(events, ':') = 0;
