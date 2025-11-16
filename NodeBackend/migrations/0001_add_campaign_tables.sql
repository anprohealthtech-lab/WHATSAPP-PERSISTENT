-- Migration: Add campaign tables
-- Created: 2025-11-16

CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"original_message" text NOT NULL,
	"fixed_params" jsonb,
	"selected_variation" text,
	"total_contacts" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "campaign_recipients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"extra" jsonb,
	"status" text DEFAULT 'pending',
	"sent_at" timestamp,
	"error_reason" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_variations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar NOT NULL,
	"variation" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "campaign_recipients" 
ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" 
FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE;

ALTER TABLE "message_variations" 
ADD CONSTRAINT "message_variations_campaign_id_fkey" 
FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "campaign_recipients_campaign_id_idx" ON "campaign_recipients"("campaign_id");
CREATE INDEX IF NOT EXISTS "campaign_recipients_status_idx" ON "campaign_recipients"("status");
CREATE INDEX IF NOT EXISTS "message_variations_campaign_id_idx" ON "message_variations"("campaign_id");
