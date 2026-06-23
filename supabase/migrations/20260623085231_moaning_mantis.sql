ALTER TABLE "actions" ADD COLUMN "target_calendar_id" uuid;--> statement-breakpoint

-- Calendario di destinazione per gli eventi generati dall'Action (Sotto-Ciclo 3.3).
-- NULL = calendario primario dell'utente. FK dichiarata qui (non nello schema
-- Drizzle) per evitare un import circolare actions.ts <-> calendar.ts.
-- ON DELETE SET NULL: se il calendario viene eliminato, l'Action resta valida e
-- ricade sul primario.
ALTER TABLE "actions" ADD CONSTRAINT "actions_target_calendar_id_calendars_id_fk" FOREIGN KEY ("target_calendar_id") REFERENCES "public"."calendars"("id") ON DELETE set null ON UPDATE no action;