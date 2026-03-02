-- Migration 008: add business_unit to projects
-- Used to group projects restrict visibility based on user's business unit

ALTER TABLE IF EXISTS projects
ADD COLUMN IF NOT EXISTS business_unit TEXT;
