-- Migration: Fix access code constraint duplicate key violations
-- Drop the restrictive unique constraint UNIQUE(role, active) which only allows one active and one inactive code per role
ALTER TABLE public.access_codes DROP CONSTRAINT IF EXISTS access_codes_role_active_key;

-- Create a partial unique index that only enforces uniqueness for active codes
-- This allows having only one active code per role, while allowing an unlimited history of inactive codes
CREATE UNIQUE INDEX IF NOT EXISTS access_codes_role_active_idx ON public.access_codes (role) WHERE (active = true);
