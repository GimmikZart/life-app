CREATE TABLE "external_calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"calendar_id" uuid,
	"provider_account_email" text,
	"provider_calendar_id" text DEFAULT 'primary' NOT NULL,
	"provider_calendar_name" text,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"sync_cursor" text,
	"webhook_channel_id" text,
	"webhook_resource_id" text,
	"webhook_subscription_id" text,
	"webhook_secret_encrypted" text,
	"webhook_expires_at" timestamp with time zone,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_calendar_connections_user_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "external_calendar_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"event_id" uuid,
	"operation" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_source_external_id_unique";--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "external_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "external_calendar_id" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "external_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "sync_status" text DEFAULT 'synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "external_calendar_connections" ADD CONSTRAINT "external_calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_connections" ADD CONSTRAINT "external_calendar_connections_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_sync_jobs" ADD CONSTRAINT "external_calendar_sync_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_sync_jobs" ADD CONSTRAINT "external_calendar_sync_jobs_connection_id_external_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_calendar_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_sync_jobs" ADD CONSTRAINT "external_calendar_sync_jobs_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_calendar_connections_user_idx" ON "external_calendar_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "external_calendar_connections_calendar_idx" ON "external_calendar_connections" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "external_calendar_sync_jobs_connection_status_idx" ON "external_calendar_sync_jobs" USING btree ("connection_id","status");--> statement-breakpoint
CREATE INDEX "external_calendar_sync_jobs_user_status_idx" ON "external_calendar_sync_jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "external_calendar_sync_jobs_event_idx" ON "external_calendar_sync_jobs" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_external_connection_id_external_calendar_connections_id_fk" FOREIGN KEY ("external_connection_id") REFERENCES "public"."external_calendar_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_external_connection_idx" ON "calendar_events" USING btree ("external_connection_id");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_external_identity_unique" UNIQUE("external_connection_id","external_calendar_id","external_id");
--> statement-breakpoint
ALTER TABLE "external_calendar_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "external_calendar_sync_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "external_calendar_connections_owner_all"
ON "external_calendar_connections"
FOR ALL
USING ("user_id" = auth.uid())
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "external_calendar_sync_jobs_owner_all"
ON "external_calendar_sync_jobs"
FOR ALL
USING ("user_id" = auth.uid())
WITH CHECK ("user_id" = auth.uid());
