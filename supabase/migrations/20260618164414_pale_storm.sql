ALTER TABLE "calendar_events" ADD COLUMN "pinned_to_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_members" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_members" ADD COLUMN "auto_integrate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_members_one_primary_per_user_unique" ON "calendar_members" USING btree ("user_id") WHERE "calendar_members"."is_primary" = true;