ALTER TABLE "regression_runs" ADD COLUMN "pipeline_run_id" uuid;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "canonical_key" text;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "identity_hash" text;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "question_index" integer;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "config_json" jsonb;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "old_output_json" jsonb;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "new_output_json" jsonb;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "old_meta_json" jsonb;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "new_meta_json" jsonb;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "comparison_meta_json" jsonb;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "failure_json" jsonb;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "regression_runs" ADD COLUMN "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "regression_runs" ADD CONSTRAINT "regression_runs_pipeline_run_fk" FOREIGN KEY ("pipeline_run_id") REFERENCES "pipeline_runs"("id");
--> statement-breakpoint
ALTER TABLE "regression_runs" ADD CONSTRAINT "regression_runs_source_fk" FOREIGN KEY ("source_id") REFERENCES "sources"("id");
--> statement-breakpoint
ALTER TABLE "regression_runs" ADD CONSTRAINT "regression_runs_status_check" CHECK ("status" IN ('PENDING','BASE_DONE','ANSWERS_DONE','COMPLETE','FAILED'));
--> statement-breakpoint
CREATE UNIQUE INDEX "regression_runs_identity_unique" ON "regression_runs" ("identity_hash") WHERE "identity_hash" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "regression_runs_incident_order" ON "regression_runs" ("incident_id","question_index","created_at");
