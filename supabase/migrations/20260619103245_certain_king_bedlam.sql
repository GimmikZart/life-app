CREATE TABLE "event_official_pins" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "event_official_pins_event_id_user_id_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_official_pins" ADD CONSTRAINT "event_official_pins_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_official_pins" ADD CONSTRAINT "event_official_pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_official_pins_user_id_idx" ON "event_official_pins" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "event_official_pins" ("event_id","user_id") SELECT "id","user_id" FROM "calendar_events" WHERE "pinned_to_primary" = true ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "calendar_events" DROP COLUMN "pinned_to_primary";