CREATE TABLE "action_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"calendar_event_id" uuid,
	"occurrence_date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"points_awarded" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	CONSTRAINT "action_completions_action_id_occurrence_date_unique" UNIQUE("action_id","occurrence_date")
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"frequency" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_completions" ADD CONSTRAINT "action_completions_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_completions" ADD CONSTRAINT "action_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_completions_action_id_idx" ON "action_completions" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "action_completions_calendar_event_id_idx" ON "action_completions" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE INDEX "actions_user_id_idx" ON "actions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Peso dell'impegno vincolato a 1|2|3 (Project Knowledge v2, sez. 3.2).
ALTER TABLE "actions" ADD CONSTRAINT "actions_weight_check" CHECK ("weight" IN (1, 2, 3));--> statement-breakpoint

-- Foreign key di action_completions.calendar_event_id verso l'evento calendario
-- generato. Dichiarata qui e non nello schema Drizzle per evitare un import
-- circolare actions.ts <-> calendar.ts. ON DELETE SET NULL: se l'evento collegato
-- viene eliminato manualmente, lo storico del completamento resta intatto
-- (occurrence_date preserva streak/consistency), il riferimento diventa NULL
-- (nodo aperto risolto nel Sotto-Ciclo 3.4).
ALTER TABLE "action_completions" ADD CONSTRAINT "action_completions_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- RLS: ogni utente vede/modifica solo le proprie Action e i propri completamenti.
ALTER TABLE "actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "action_completions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "actions_select_own"
ON "actions"
FOR SELECT
TO authenticated
USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "actions_insert_own"
ON "actions"
FOR INSERT
TO authenticated
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "actions_update_own"
ON "actions"
FOR UPDATE
TO authenticated
USING ("user_id" = auth.uid())
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "actions_delete_own"
ON "actions"
FOR DELETE
TO authenticated
USING ("user_id" = auth.uid());
--> statement-breakpoint

CREATE POLICY "action_completions_select_own"
ON "action_completions"
FOR SELECT
TO authenticated
USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "action_completions_insert_own"
ON "action_completions"
FOR INSERT
TO authenticated
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "action_completions_update_own"
ON "action_completions"
FOR UPDATE
TO authenticated
USING ("user_id" = auth.uid())
WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "action_completions_delete_own"
ON "action_completions"
FOR DELETE
TO authenticated
USING ("user_id" = auth.uid());