-- Create shared_contexts table for shared YJS context documents
CREATE TABLE IF NOT EXISTS "shared_contexts" (
  "name" TEXT PRIMARY KEY,
  "organization_id" UUID,
  "subroutine_slug" TEXT,
  "state" BYTEA,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "byte_size" BIGINT DEFAULT 0
);

