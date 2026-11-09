-- Better Auth finds the account a Google sign-in belongs to by provider and Google's own id
-- (`providerId = ? AND accountId = ?`, liveworkspace/docs/specs/003-accounts/sign-in.md). 0001 indexed only `userId`,
-- so every Google sign-in read the whole table: 50,000 rows and 2.5 ms in a local SQLite copy, 0.02 ms by this index.
-- Building it reads the table once. Written by hand, like 0002.
CREATE INDEX account_provider_account_idx ON "account" ("providerId", "accountId");
