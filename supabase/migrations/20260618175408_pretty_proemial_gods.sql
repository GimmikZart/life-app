CREATE TYPE "public"."relationship_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "status" "relationship_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "relationships_target_status_idx" ON "relationships" USING btree ("target_user_id","status");