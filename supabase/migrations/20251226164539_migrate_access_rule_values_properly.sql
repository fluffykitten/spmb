/*
  # Migrate access_rule Values to New Design (Proper Order)

  1. Changes
    - Drop old constraint FIRST
    - Update existing access_rule values from old design to new design
    - Map old values to new values:
      - 'always' -> 'all'
      - 'after_submission' -> 'status_based' (with appropriate required_status)
      - 'after_approval' -> 'status_based' (with required_status = ['approved'])
      - 'after_rejection' -> 'status_based' (with required_status = ['rejected'])
    - Add new constraint with values: 'all', 'status_based', 'manual'

  2. Notes
    - Order matters: drop constraint, update data, add new constraint
    - Preserves existing data by mapping to equivalent new values
*/

ALTER TABLE letter_templates
  DROP CONSTRAINT IF EXISTS letter_templates_access_rule_check;

UPDATE letter_templates
SET 
  access_rule = CASE access_rule
    WHEN 'always' THEN 'all'
    WHEN 'after_submission' THEN 'status_based'
    WHEN 'after_approval' THEN 'status_based'
    WHEN 'after_rejection' THEN 'status_based'
    ELSE access_rule
  END,
  required_status = CASE access_rule
    WHEN 'always' THEN NULL
    WHEN 'after_submission' THEN ARRAY['submitted']::text[]
    WHEN 'after_approval' THEN ARRAY['approved']::text[]
    WHEN 'after_rejection' THEN ARRAY['rejected']::text[]
    ELSE required_status
  END
WHERE access_rule IN ('always', 'after_submission', 'after_approval', 'after_rejection');

ALTER TABLE letter_templates
  ADD CONSTRAINT letter_templates_access_rule_check
  CHECK (access_rule IN ('all', 'status_based', 'manual'));