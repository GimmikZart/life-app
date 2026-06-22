CREATE TABLE "event_exceptions" (
	"event_id" uuid NOT NULL,
	"occurrence_date" timestamp with time zone NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"title" text,
	"category" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"visibility_default" "event_visibility",
	CONSTRAINT "event_exceptions_event_id_occurrence_date_unique" UNIQUE("event_id","occurrence_date")
);
--> statement-breakpoint
ALTER TABLE "event_exceptions" ADD CONSTRAINT "event_exceptions_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_exceptions_event_id_idx" ON "event_exceptions" USING btree ("event_id");