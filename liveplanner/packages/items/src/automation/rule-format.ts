// The rule body's format in words (docs/specs/026-plan/automations.md "Agents and the CLI", "Describe a Rule"): every
// trigger, condition and step kind with its fields and limits. The one description of a rule that an agent's tools
// (the MCP's change_rules) and Describe a Rule's model are given; readRuleBody checks what comes back. A kind added to
// types.ts is described here too (rule-format.test.ts fails until it is).
import { AUTOMATION_ACTIONS_MAX, AUTOMATION_CONDITIONS_MAX } from './types';

export const RULE_TRIGGER_FORMAT =
  'What starts the rule, exactly one: ' +
  '{"kind":"card_created","status"?:column} (a card added, by anyone or anything, optionally landing in that column); ' +
  '{"kind":"form_response","formTab"?:Form tab} (a form response makes a card); ' +
  '{"kind":"card_moved","from"?:[columns],"to"?:[columns]} (its status changes); ' +
  '{"kind":"field_changed","fields":[fields, at least one]}; ' +
  '{"kind":"comment_added"} (a thread started or replied to); ' +
  '{"kind":"manual"} (Run from a Card: run it with change_rules run); ' +
  '{"kind":"scheduled","every":"day"|"weekday"|"week"|"month","days"?:[0 Sunday to 6 Saturday, for week],' +
  '"dayOfMonth"?:1 to 31 (for month; past the month’s end is its last day),"at":"HH:MM" on the quarter hour}; ' +
  '{"kind":"due_in","days":1 to 30,"at":"HH:MM"} (that many days before a card is due); ' +
  '{"kind":"overdue","at":"HH:MM"} (the day after a card’s due date passed, not in a done column); ' +
  '{"kind":"stuck","days":1 to 90,"at":"HH:MM","statuses"?:[columns]} (daily: cards unchanged that long, outside ' +
  'done columns, once per stretch unchanged); ' +
  '{"kind":"card_archived"}; {"kind":"card_restored"}; ' +
  '{"kind":"checklist_completed"} (the last checklist item is ticked); ' +
  '{"kind":"threads_resolved"} (the last open comment thread on a card is resolved); ' +
  '{"kind":"mentioned","people"?:[people]} (a comment @mentions someone, or one of them); ' +
  '{"kind":"card_unblocked"} (the last open card blocking it is done or archived; the unblocked card runs it); ' +
  '{"kind":"related_done","related":"children"|"linked"} (the last of its children, or of the cards its Card fields ' +
  'point at, reaches a done column; that card runs it); ' +
  '{"kind":"column_limit","status":column,"limit":1 to 500} (a card goes in and the column holds more than the ' +
  'limit; once each time it goes over); ' +
  '{"kind":"incoming_webhook"} (another tool calls the rule’s own address with its secret, made once the rule is ' +
  'saved; the call names the cards, and its JSON body’s values read as {{webhook.<name>}}, up to 5 names deep). ' +
  'A time trigger (scheduled, due_in, overdue, stuck) runs once for each card its conditions match (every card with none), ' +
  'up to 100 a moment, at the time in the rule’s timeZone, and has nobody behind it: no who condition, no ' +
  '"trigger" assignee or recipient.';

export const RULE_CONDITIONS_FORMAT =
  `Up to ${AUTOMATION_CONDITIONS_MAX}, every one must hold (for a time trigger, they pick its cards): ` +
  '{"kind":"type","types":[card types],"not"?:true}; ' +
  '{"kind":"column","statuses":[columns],"not"?:true}; ' +
  '{"kind":"field","field":field,"op":"is"|"is_not"|"empty"|"not_empty"|"contains"|"not_contains"|"before"|' +
  '"after"|"on_or_before"|"on_or_after"|"less_than"|"more_than","value"?:...} where value is absent for empty and ' +
  'not_empty, a day for the date ops ({"day":"YYYY-MM-DD"} or {"today":±whole days}), a number for less_than and ' +
  'more_than, else text, a number or a list; ' +
  '{"kind":"who","who":[{"person":person} or {"role":"editor"|"participant"|"agent"}],"not"?:true} (who made the ' +
  'change); {"kind":"saved_filter","tab":the board’s tab,"filter":the saved filter’s id}. ' +
  'A condition on a field the card’s type lacks does not hold. Defaults to none.';

export const RULE_STEPS_FORMAT =
  `1 to ${AUTOMATION_ACTIONS_MAX} actions in order, counting those inside an if or a for: ` +
  '{"kind":"move","status":column}; ' +
  '{"kind":"set_field","field":field,"value":{"text":"..."}|{"number":n}|{"list":["..."]}|' +
  '{"date":{"today":±days}} (today is {"date":{"today":0}})|{"date":{"day":"YYYY-MM-DD"}}|' +
  '{"from":another field of the card}}; ' +
  '{"kind":"clear_field","field":field}; ' +
  '{"kind":"assign","to":{"person":person}|{"trigger":true} (whoever triggered it)|{"nobody":true}|' +
  '{"rotate":[2 to 10 people]} (each run the next, in turn)}; ' +
  '{"kind":"add_label","label":"..."}; {"kind":"remove_label","label":"..."}; ' +
  '{"kind":"comment","text":"..."} (a new thread on the card, by Automation); ' +
  '{"kind":"flag"}; {"kind":"unflag"}; {"kind":"archive"}; ' +
  '{"kind":"create_card","type":card type,"title":"...","status"?:column,"copy"?:["assignee","labels","due"],' +
  '"linkField"?:a Card field of the new card pointing back}; at most one a run; ' +
  '{"kind":"email","to":{"assignee":true}|{"trigger":true}|{"person":person},"subject":"... up to 200",' +
  '"body":"..."} (people with an account only); ' +
  '{"kind":"set_type","type":card type} (its column must suit the new type); ' +
  '{"kind":"set_colour","colour":"#rrggbb"|null}; {"kind":"restore"} (out of the archive); ' +
  '{"kind":"copy_card","status"?:column} (a copy of the card, in its column or that one; counts as the run’s one ' +
  'new card); {"kind":"add_checklist","items":["... up to 200",1 to 20]} (unticked; an item already there is ' +
  'left out); {"kind":"link_card","field":a Card field,"to":{"card":card id}|{"trigger":true}} (trigger: the card ' +
  'that started it, inside a for only); ' +
  '{"kind":"mention","to":{"assignee":true}|{"trigger":true}|{"person":person},"text":"..."} (a thread ' +
  '@mentioning them, their Inbox and a mention email); {"kind":"resolve_threads"}; ' +
  '{"kind":"wait","hours":1 to 720} (top level only, up to 3 a rule: the steps after it run when the time is up, ' +
  'if the conditions still hold); ' +
  '{"kind":"notify","via":"webhook"|"slack"|"teams","webhook":the webhook’s id from the plan’s Webhooks dialog,' +
  '"text":"..."} (top level only, up to 5 a rule; only an Editor of the whole plan can name one); ' +
  '{"kind":"ai","task":"summarise","field"?:a Text or Long Text field (absent: a comment)}, ' +
  '{"kind":"ai","task":"card_type","set":true (set it)|false (comment the suggestion)} or ' +
  '{"kind":"ai","task":"triage","priority":true|false,"labels":true|false (at least one true)} (the AI actions: ' +
  'top level only, up to 3 a rule, each one of the plan’s 100 AI steps a day); ' +
  '{"kind":"if","conditions":[conditions],"then":[actions],"else":[actions]} (actions only inside); ' +
  '{"kind":"for","related":{"kind":"linked","field"?:a Card field}|{"kind":"blocked_by"}|{"kind":"blocking"}|' +
  '{"kind":"children"}|{"kind":"saved_filter","tab":tab,"filter":id},"conditions":[conditions on the related card],' +
  '"then":[1 to 10 actions, no create_card, copy_card, notify or wait]} (each related card, up to 100). ' +
  'Text (a comment, a title, a text value, an email body, a message, up to 2,000 characters) may hold values: ' +
  '{{card.title}}, {{card.key}}, {{card.url}}, {{card.assignee}}, {{card.column}}, {{card.due}}, ' +
  '{{card.field.<Field Name>}}, {{person}} (who triggered it), {{rule}}, {{now}}, {{now.date}}, {{now + 3d}} and ' +
  '{{now - 1d}}; inside a for, {{trigger.title}}, {{trigger.key}} and {{trigger.url}} name the card that started ' +
  'it. Defaults to none: a rule with no action saves off.';
