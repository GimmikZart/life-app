CREATE TYPE "public"."calendar_member_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."calendar_permission" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."calendar_type" AS ENUM('personal', 'couple', 'family', 'work', 'custom');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('clear', 'busy', 'hidden');--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"visibility_default" "event_visibility" DEFAULT 'clear' NOT NULL,
	"source" text DEFAULT 'life_app' NOT NULL,
	"external_id" text,
	"action_id" uuid,
	CONSTRAINT "calendar_events_source_external_id_unique" UNIQUE("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "calendar_members" (
	"calendar_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission" "calendar_permission" DEFAULT 'viewer' NOT NULL,
	"status" "calendar_member_status" DEFAULT 'pending' NOT NULL,
	CONSTRAINT "calendar_members_calendar_id_user_id_unique" UNIQUE("calendar_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#2563eb' NOT NULL,
	"type" "calendar_type" DEFAULT 'personal' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_associations" (
	"event_id" uuid NOT NULL,
	"associated_user_id" uuid NOT NULL,
	"display_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "event_associations_event_id_associated_user_id_unique" UNIQUE("event_id","associated_user_id")
);
--> statement-breakpoint
CREATE TABLE "event_visibility_overrides" (
	"event_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"visibility" "event_visibility" NOT NULL,
	CONSTRAINT "event_visibility_overrides_event_id_target_user_id_unique" UNIQUE("event_id","target_user_id")
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"visibility_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "relationships_user_id_target_user_id_unique" UNIQUE("user_id","target_user_id")
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_members" ADD CONSTRAINT "calendar_members_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_members" ADD CONSTRAINT "calendar_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_associations" ADD CONSTRAINT "event_associations_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_associations" ADD CONSTRAINT "event_associations_associated_user_id_users_id_fk" FOREIGN KEY ("associated_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_visibility_overrides" ADD CONSTRAINT "event_visibility_overrides_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_visibility_overrides" ADD CONSTRAINT "event_visibility_overrides_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_calendar_start_idx" ON "calendar_events" USING btree ("calendar_id","start_at");--> statement-breakpoint
CREATE INDEX "calendar_events_user_start_idx" ON "calendar_events" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE INDEX "calendar_members_user_status_idx" ON "calendar_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "calendars_user_id_idx" ON "calendars" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_associations_associated_user_id_idx" ON "event_associations" USING btree ("associated_user_id");--> statement-breakpoint
CREATE INDEX "event_visibility_overrides_target_user_id_idx" ON "event_visibility_overrides" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "relationships_target_user_id_idx" ON "relationships" USING btree ("target_user_id");
--> statement-breakpoint

-- RLS base per il Calendario.
-- Le policy qui sotto proteggono accesso e lettura tramite membership accettata.
-- Le regole granulari clear/busy/hidden verranno risolte a livello applicativo nel Sotto-Ciclo 2.5a.
ALTER TABLE "calendars" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "calendar_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "relationships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_visibility_overrides" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_associations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "calendars_select_accepted_members"
ON "calendars"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "calendar_members"
    WHERE "calendar_members"."calendar_id" = "calendars"."id"
      AND "calendar_members"."user_id" = auth.uid()
      AND "calendar_members"."status" = 'accepted'
  )
);
--> statement-breakpoint
CREATE POLICY "calendars_insert_own"
ON "calendars"
FOR INSERT
TO authenticated
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "calendars_update_owners"
ON "calendars"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "calendar_members"
    WHERE "calendar_members"."calendar_id" = "calendars"."id"
      AND "calendar_members"."user_id" = auth.uid()
      AND "calendar_members"."permission" = 'owner'
      AND "calendar_members"."status" = 'accepted'
  )
)
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "calendars_delete_owners"
ON "calendars"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "calendar_members"
    WHERE "calendar_members"."calendar_id" = "calendars"."id"
      AND "calendar_members"."user_id" = auth.uid()
      AND "calendar_members"."permission" = 'owner'
      AND "calendar_members"."status" = 'accepted'
  )
);
--> statement-breakpoint

CREATE POLICY "calendar_members_select_own_rows"
ON "calendar_members"
FOR SELECT
TO authenticated
USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "calendar_members_insert_own_pending_or_accepted"
ON "calendar_members"
FOR INSERT
TO authenticated
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "calendar_members_update_own_status"
ON "calendar_members"
FOR UPDATE
TO authenticated
USING ("user_id" = auth.uid())
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint

CREATE POLICY "calendar_events_select_accepted_members"
ON "calendar_events"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "calendar_members"
    WHERE "calendar_members"."calendar_id" = "calendar_events"."calendar_id"
      AND "calendar_members"."user_id" = auth.uid()
      AND "calendar_members"."status" = 'accepted'
  )
);
--> statement-breakpoint
CREATE POLICY "calendar_events_insert_editors"
ON "calendar_events"
FOR INSERT
TO authenticated
WITH CHECK (
  "user_id" = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM "calendar_members"
    WHERE "calendar_members"."calendar_id" = "calendar_events"."calendar_id"
      AND "calendar_members"."user_id" = auth.uid()
      AND "calendar_members"."permission" IN ('owner', 'editor')
      AND "calendar_members"."status" = 'accepted'
  )
);
--> statement-breakpoint
CREATE POLICY "calendar_events_update_editors"
ON "calendar_events"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "calendar_members"
    WHERE "calendar_members"."calendar_id" = "calendar_events"."calendar_id"
      AND "calendar_members"."user_id" = auth.uid()
      AND "calendar_members"."permission" IN ('owner', 'editor')
      AND "calendar_members"."status" = 'accepted'
  )
)
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "calendar_events_delete_editors"
ON "calendar_events"
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "calendar_members"
    WHERE "calendar_members"."calendar_id" = "calendar_events"."calendar_id"
      AND "calendar_members"."user_id" = auth.uid()
      AND "calendar_members"."permission" IN ('owner', 'editor')
      AND "calendar_members"."status" = 'accepted'
  )
);
--> statement-breakpoint

CREATE POLICY "relationships_select_participants"
ON "relationships"
FOR SELECT
TO authenticated
USING ("user_id" = auth.uid() OR "target_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "relationships_insert_own"
ON "relationships"
FOR INSERT
TO authenticated
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "relationships_update_own"
ON "relationships"
FOR UPDATE
TO authenticated
USING ("user_id" = auth.uid())
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "relationships_delete_own"
ON "relationships"
FOR DELETE
TO authenticated
USING ("user_id" = auth.uid());
--> statement-breakpoint

CREATE POLICY "event_visibility_overrides_select_relevant_users"
ON "event_visibility_overrides"
FOR SELECT
TO authenticated
USING (
  "target_user_id" = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM "calendar_events"
    WHERE "calendar_events"."id" = "event_visibility_overrides"."event_id"
      AND "calendar_events"."user_id" = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "event_visibility_overrides_write_event_owners"
ON "event_visibility_overrides"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "calendar_events"
    WHERE "calendar_events"."id" = "event_visibility_overrides"."event_id"
      AND "calendar_events"."user_id" = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "calendar_events"
    WHERE "calendar_events"."id" = "event_visibility_overrides"."event_id"
      AND "calendar_events"."user_id" = auth.uid()
  )
);
--> statement-breakpoint

CREATE POLICY "event_associations_select_relevant_users"
ON "event_associations"
FOR SELECT
TO authenticated
USING (
  "associated_user_id" = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM "calendar_events"
    WHERE "calendar_events"."id" = "event_associations"."event_id"
      AND "calendar_events"."user_id" = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "event_associations_write_event_owners"
ON "event_associations"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "calendar_events"
    WHERE "calendar_events"."id" = "event_associations"."event_id"
      AND "calendar_events"."user_id" = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "calendar_events"
    WHERE "calendar_events"."id" = "event_associations"."event_id"
      AND "calendar_events"."user_id" = auth.uid()
  )
);
