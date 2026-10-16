-- Equipment an exercise needs (multi-select). Keys come from EQUIPMENT_LABELS in
-- src/lib/equipment.ts; deliberately not CHECK-constrained so the list can grow
-- without a migration. Empty = bodyweight / not tagged.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}';
