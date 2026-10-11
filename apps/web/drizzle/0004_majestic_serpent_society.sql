CREATE TABLE "credit_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"package_id" text NOT NULL,
	"credits" integer NOT NULL,
	"amount" integer NOT NULL,
	"provider" text NOT NULL,
	"payment_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "credit_orders_payment_key_unique" UNIQUE("payment_key")
);
