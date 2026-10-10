CREATE TABLE "graded_exam_feedback" (
	"exam_id" uuid NOT NULL,
	"slot_no" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graded_exam_feedback_exam_id_slot_no_pk" PRIMARY KEY("exam_id","slot_no")
);
--> statement-breakpoint
CREATE TABLE "graded_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"questions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graded_exam_feedback" ADD CONSTRAINT "graded_exam_feedback_exam_id_graded_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."graded_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graded_exams" ADD CONSTRAINT "graded_exams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;