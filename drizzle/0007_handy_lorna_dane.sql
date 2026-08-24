-- better-auth 1.7 identifies an account by the issuer that vouched for it, so this column is
-- required rather than additive: without it the adapter cannot build its lookup and every OAuth
-- callback fails at the database.
--
-- Three steps rather than one `ADD COLUMN ... NOT NULL`, because a database that already holds
-- accounts has to be told what their issuer was. Adding the column NOT NULL against existing rows
-- fails at the ADD, which says nothing about which rows were the problem. This way the backfill
-- runs first and the constraint comes last, so an issuer nobody accounted for is reported by the
-- SET NOT NULL — and the fix is to add its UPDATE above, not to relax the column.
ALTER TABLE "accounts" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "accounts" SET "issuer" = 'https://accounts.google.com' WHERE "provider_id" = 'google' AND "issuer" IS NULL;--> statement-breakpoint
UPDATE "accounts" SET "issuer" = 'https://www.facebook.com' WHERE "provider_id" = 'facebook' AND "issuer" IS NULL;--> statement-breakpoint
UPDATE "accounts" SET "issuer" = 'https://access.line.me' WHERE "provider_id" = 'line' AND "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;
