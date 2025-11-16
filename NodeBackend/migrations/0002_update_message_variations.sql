-- Update message_variations table to match edge function requirements
ALTER TABLE message_variations 
  RENAME COLUMN variation TO message;

ALTER TABLE message_variations 
  ADD COLUMN IF NOT EXISTS original_message TEXT,
  ADD COLUMN IF NOT EXISTS variation_number INTEGER,
  ADD COLUMN IF NOT EXISTS fixed_params JSONB;
