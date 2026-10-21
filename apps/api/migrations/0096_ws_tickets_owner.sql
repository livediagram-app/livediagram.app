-- Room tickets carry the owner bit (the facilitator baton's "Who may take it";
-- docs/specs/015-api/api.md "Realtime model"). Every editor now joins its room through a ticket, so the
-- `X-Verified-Owner` bit the facilitator baton needs ("the owner can always take it back") has to ride the
-- ticket: before this, only a bare `?o=` upgrade could set it, and a signed-in owner (who always rode a ticket)
-- was never seated as the owner. 1 when the mint resolved the caller as the document's owner (ownsDocument).
-- Tickets live 60 s, so the DEFAULT only ever applies to tickets minted in the seconds around the deploy.
ALTER TABLE ws_tickets ADD COLUMN owner INTEGER NOT NULL DEFAULT 0;
