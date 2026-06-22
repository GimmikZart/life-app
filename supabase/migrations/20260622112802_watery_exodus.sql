ALTER TABLE "calendars" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_share_token_unique" UNIQUE("share_token");