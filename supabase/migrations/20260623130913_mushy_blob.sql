CREATE TYPE "public"."skill_contribution_type" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TABLE "event_objectives" (
	"calendar_event_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	CONSTRAINT "event_objectives_event_objective_unique" UNIQUE("calendar_event_id","objective_id")
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"points_awarded" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	CONSTRAINT "event_completions_event_occurrence_unique" UNIQUE("calendar_event_id","occurrence_date")
);
--> statement-breakpoint
CREATE TABLE "event_skills" (
	"calendar_event_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"contribution_weight" integer DEFAULT 100 NOT NULL,
	"type" "skill_contribution_type" DEFAULT 'primary' NOT NULL,
	CONSTRAINT "event_skills_event_skill_unique" UNIQUE("calendar_event_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "skill_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_level" real DEFAULT 0 NOT NULL,
	"skill_momentum" real DEFAULT 0 NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_weights" (
	"parent_skill_id" uuid NOT NULL,
	"child_skill_id" uuid NOT NULL,
	"weight" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "skill_weights_parent_child_unique" UNIQUE("parent_skill_id","child_skill_id")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_skill_id" uuid,
	"decay_coefficient" real DEFAULT 0.1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "badges_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_badges_user_badge_unique" UNIQUE("user_id","badge_id")
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "weight" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_objectives" ADD CONSTRAINT "event_objectives_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_objectives" ADD CONSTRAINT "event_objectives_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_completions" ADD CONSTRAINT "event_completions_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_completions" ADD CONSTRAINT "event_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_skills" ADD CONSTRAINT "event_skills_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_skills" ADD CONSTRAINT "event_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_weights" ADD CONSTRAINT "skill_weights_parent_skill_id_skills_id_fk" FOREIGN KEY ("parent_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_weights" ADD CONSTRAINT "skill_weights_child_skill_id_skills_id_fk" FOREIGN KEY ("child_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_parent_skill_id_skills_id_fk" FOREIGN KEY ("parent_skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_objectives_objective_idx" ON "event_objectives" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "objectives_user_id_idx" ON "objectives" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_completions_user_idx" ON "event_completions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_skills_skill_idx" ON "event_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_progress_skill_recorded_idx" ON "skill_progress" USING btree ("skill_id","recorded_at");--> statement-breakpoint
CREATE INDEX "skill_weights_child_idx" ON "skill_weights" USING btree ("child_skill_id");--> statement-breakpoint
CREATE INDEX "skills_user_id_idx" ON "skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "skills_parent_idx" ON "skills" USING btree ("parent_skill_id");--> statement-breakpoint
CREATE INDEX "user_badges_user_idx" ON "user_badges" USING btree ("user_id");--> statement-breakpoint

-- Peso dell'evento-Action vincolato a 1|2|3 (Project Knowledge v2 sez. 3.2/3.4).
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_weight_check" CHECK ("weight" IN (1, 2, 3));--> statement-breakpoint

-- RLS: ogni utente vede/modifica solo i propri obiettivi, skill, progressi,
-- completamenti e badge ottenuti. Il catalogo `badges` e leggibile da tutti.
ALTER TABLE "objectives" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_objectives" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "skill_weights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "skill_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_completions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Tabelle con user_id diretto: policy semplice.
CREATE POLICY "objectives_own" ON "objectives" FOR ALL TO authenticated
USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "skills_own" ON "skills" FOR ALL TO authenticated
USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "skill_progress_own" ON "skill_progress" FOR ALL TO authenticated
USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "event_completions_own" ON "event_completions" FOR ALL TO authenticated
USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "user_badges_own" ON "user_badges" FOR ALL TO authenticated
USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint

-- Ponti senza user_id: ownership verificata tramite l'entita collegata.
CREATE POLICY "event_objectives_via_event" ON "event_objectives" FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM "calendar_events" WHERE "calendar_events"."id" = "event_objectives"."calendar_event_id" AND "calendar_events"."user_id" = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM "calendar_events" WHERE "calendar_events"."id" = "event_objectives"."calendar_event_id" AND "calendar_events"."user_id" = auth.uid()));
--> statement-breakpoint
CREATE POLICY "event_skills_via_event" ON "event_skills" FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM "calendar_events" WHERE "calendar_events"."id" = "event_skills"."calendar_event_id" AND "calendar_events"."user_id" = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM "calendar_events" WHERE "calendar_events"."id" = "event_skills"."calendar_event_id" AND "calendar_events"."user_id" = auth.uid()));
--> statement-breakpoint
CREATE POLICY "skill_weights_via_skill" ON "skill_weights" FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM "skills" WHERE "skills"."id" = "skill_weights"."parent_skill_id" AND "skills"."user_id" = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM "skills" WHERE "skills"."id" = "skill_weights"."parent_skill_id" AND "skills"."user_id" = auth.uid()));
--> statement-breakpoint

CREATE POLICY "badges_select_all" ON "badges" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

-- Seed dei 7 badge di base (Project Knowledge v2 sez. 3.4). Idempotente su `key`.
INSERT INTO "badges" ("key", "name", "description", "icon", "criteria") VALUES
  ('fuoco_sacro', 'Fuoco Sacro', '30 giorni di streak consecutivi', '🔥', '{"type":"streak_days","value":30}'::jsonb),
  ('alba_produttiva', 'Alba Produttiva', '20 action completate prima delle 9:00', '🌅', '{"type":"completions_before_hour","hour":9,"value":20}'::jsonb),
  ('resiliente', 'Resiliente', 'Riprendi una skill dopo 30+ giorni di inattivita', '🔄', '{"type":"skill_resumed_after_days","value":30}'::jsonb),
  ('equilibrista', 'Equilibrista', 'Mantieni 5 skill attive contemporaneamente', '⚖️', '{"type":"active_skills","value":5}'::jsonb),
  ('cecchino', 'Cecchino', '10 action consecutive senza saltarne una', '🎯', '{"type":"consecutive_completions","value":10}'::jsonb),
  ('costruttore', 'Costruttore', 'Aggiungi la prima Proprieta personalizzata', '🧩', '{"type":"first_custom_property"}'::jsonb),
  ('connesso', 'Connesso', 'Condividi il calendario con un altro utente', '👥', '{"type":"calendar_shared_accepted"}'::jsonb)
ON CONFLICT ("key") DO NOTHING;