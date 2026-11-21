// A rule's Send Email (liveworkspace/docs/specs/018-automations/automations.md "Steps every app has"; blueprint
// item-engine.md "An app's bindings"): the subject and body its Editor wrote, values filled in, in the app's own
// email shell. Two forms: to a person of the item, who manages their own notifications, and to a typed-in address,
// with fixed words the rule cannot change (which rule, which item, why this address) and a link that stops this
// item's rules emailing it. Everything a rule wrote is escaped; the body's lines stay lines.
import { subjectText, type EmailSection } from '@liveworkspace/email/layout';
import { xmlEscape } from '@liveworkspace/icons';

// The app's emails, as its own templates are written: its shell and the words it calls its items by.
export interface ItemEmailLook {
  shell(section: EmailSection): string;
  // The footer of an opt-out notification: the reason, and the link to the settings.
  manageNotificationsFooter(reason: string): string;
  // Where every opt-out category is turned off.
  profileUrl: string;
  // What the app's emails call an item ("canvas", "document") and the app itself ("livediagram").
  noun: string;
  product: string;
  // The links' colour in a footer.
  linkColour: string;
}

export type ItemEmailInput = {
  subject: string;
  body: string;
  rule: string;
  itemName: string;
  // Where the button goes: the item, or the run's tab.
  url: string;
};

export type ItemRenderedEmail = {
  kind: 'AutomationEmail';
  subject: string;
  html: string;
  unsubscribeUrl: string;
};

const linesOf = (body: string): string =>
  body
    .split(/\r?\n/)
    .map((line) => xmlEscape(line))
    .join('<br>');

const article = (noun: string): string => (/^[aeiou]/i.test(noun) ? 'an' : 'a');

const nameOf = (look: ItemEmailLook, name: string): string =>
  xmlEscape(name.trim() || `${article(look.noun)} ${look.noun}`);

/** To a person of the item. */
export function itemAutomationEmail(look: ItemEmailLook, input: ItemEmailInput): ItemRenderedEmail {
  const heading = input.subject.trim() || input.rule;
  return {
    kind: 'AutomationEmail',
    subject: subjectText(heading),
    html: look.shell({
      heading: xmlEscape(heading),
      intro: linesOf(input.body) || xmlEscape(input.rule),
      outro: `Sent by the rule <strong>${xmlEscape(input.rule)}</strong> in <strong>${nameOf(look, input.itemName)}</strong>.`,
      ctaText: `Open the ${look.noun}`,
      ctaHref: input.url,
      footer: look.manageNotificationsFooter(
        `You’re receiving this because a rule in ${article(look.noun)} ${look.noun} you work on sends it.`,
      ),
    }),
    unsubscribeUrl: look.profileUrl,
  };
}

/** To a typed-in address. `unsubscribeUrl` is the one-click POST door (sent as List-Unsubscribe),
 *  `unsubscribePage` the page the footer's link opens. */
export function itemAutomationAddressEmail(
  look: ItemEmailLook,
  input: ItemEmailInput & { unsubscribeUrl: string; unsubscribePage: string },
): ItemRenderedEmail & { oneClick: true } {
  const heading = input.subject.trim() || input.rule;
  return {
    kind: 'AutomationEmail',
    subject: subjectText(heading),
    html: look.shell({
      heading: xmlEscape(heading),
      intro: linesOf(input.body) || xmlEscape(input.rule),
      outro: `Sent by the rule <strong>${xmlEscape(input.rule)}</strong> in the ${look.noun} <strong>${nameOf(look, input.itemName)}</strong> on ${look.product}. You got this because an Editor of the ${look.noun} added your address to the rule.`,
      ctaText: `Open the ${look.noun}`,
      ctaHref: input.url,
      footer: `Don’t want these? <a href="${xmlEscape(input.unsubscribePage)}" style="color:${look.linkColour};text-decoration:underline">Stop emails from this ${look.noun}’s rules</a>.`,
    }),
    unsubscribeUrl: input.unsubscribeUrl,
    oneClick: true,
  };
}
