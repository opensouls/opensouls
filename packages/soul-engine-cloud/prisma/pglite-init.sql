-- Generated via `bunx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
-- Initializes the local PGlite database schema.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "local_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_processors" (
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "api_endpoint" TEXT NOT NULL,
    "api_key" UUID NOT NULL,
    "opts" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_processors_pkey" PRIMARY KEY ("organization_id","name")
);

-- CreateTable
CREATE TABLE "jwts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "issuer" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jwts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subroutines" (
    "slug" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "content_key" TEXT,

    CONSTRAINT "subroutines_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "subroutine_versions" (
    "organization_id" UUID NOT NULL,
    "subroutine_slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subroutine_versions_pkey" PRIMARY KEY ("organization_id","subroutine_slug","name")
);

-- CreateTable
CREATE TABLE "subroutine_settings" (
    "organization_id" UUID NOT NULL,
    "subroutine_slug" TEXT NOT NULL,
    "enforce_jwt" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subroutine_settings_pkey" PRIMARY KEY ("organization_id","subroutine_slug")
);

-- CreateTable
CREATE TABLE "usage_metrics" (
    "id" SERIAL NOT NULL,
    "event_name" TEXT NOT NULL,
    "organization_slug" TEXT NOT NULL,
    "metadata" JSONB,
    "model" TEXT,
    "input" INTEGER,
    "output" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blueprint_name" TEXT,
    "credit_microcents_used" INTEGER,

    CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vector_store" (
    "organization_id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT,
    "embedding" vector,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" BYTEA,
    "embedding_model" TEXT DEFAULT 'mxbai-embed-xsmall-v1',

    CONSTRAINT "vector_store_pkey" PRIMARY KEY ("organization_id","bucket","key")
);

-- CreateTable
CREATE TABLE "soul_sessions" (
    "name" TEXT NOT NULL,
    "organization_id" UUID,
    "subroutine_slug" TEXT NOT NULL,
    "state" BYTEA,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byte_size" BIGINT DEFAULT 0,

    CONSTRAINT "soul_sessions_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "soul_source_docs" (
    "name" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "subroutine_slug" TEXT,
    "state" BYTEA,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byte_size" BIGINT DEFAULT 0,

    CONSTRAINT "soul_source_docs_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "debug_chat" (
    "name" TEXT NOT NULL,
    "state" BYTEA,
    "organization_id" UUID,
    "subroutine_slug" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byte_size" BIGINT DEFAULT 0,

    CONSTRAINT "debug_chat_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "debug_chat_version" (
    "name" TEXT NOT NULL,
    "state" BYTEA,
    "organization_id" UUID NOT NULL,
    "subroutine_slug" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byte_size" BIGINT DEFAULT 0,

    CONSTRAINT "debug_chat_version_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "shared_contexts" (
    "name" TEXT NOT NULL,
    "organization_id" UUID,
    "subroutine_slug" TEXT,
    "state" BYTEA,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byte_size" BIGINT DEFAULT 0,

    CONSTRAINT "shared_contexts_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "cycle_vector_stores" (
    "name" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "subroutine_slug" TEXT,
    "state" BYTEA,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byte_size" BIGINT DEFAULT 0,

    CONSTRAINT "cycle_vector_stores_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "cycle_vector_stores_version" (
    "name" TEXT NOT NULL,
    "state" BYTEA,
    "organization_id" UUID NOT NULL,
    "subroutine_slug" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byte_size" BIGINT DEFAULT 0,

    CONSTRAINT "cycle_vector_stores_version_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "allowed_github_usernames" (
    "username" TEXT NOT NULL,

    CONSTRAINT "allowed_github_usernames_pkey" PRIMARY KEY ("username")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "local_users_email_key" ON "local_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "jwts_issuer_idx" ON "jwts"("issuer");

-- CreateIndex
CREATE INDEX "jwts_organization_id_idx" ON "jwts"("organization_id");

-- CreateIndex
CREATE INDEX "usage_metrics_organization_slug_idx" ON "usage_metrics"("organization_slug");

-- CreateIndex
CREATE INDEX "idx_vector_store_metadata" ON "vector_store"("metadata");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_processors" ADD CONSTRAINT "custom_processors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jwts" ADD CONSTRAINT "jwts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subroutines" ADD CONSTRAINT "subroutines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subroutine_versions" ADD CONSTRAINT "subroutine_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subroutine_versions" ADD CONSTRAINT "subroutine_versions_subroutine_slug_fkey" FOREIGN KEY ("subroutine_slug") REFERENCES "subroutines"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subroutine_settings" ADD CONSTRAINT "subroutine_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subroutine_settings" ADD CONSTRAINT "subroutine_settings_subroutine_slug_fkey" FOREIGN KEY ("subroutine_slug") REFERENCES "subroutines"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vector_store" ADD CONSTRAINT "vector_store_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soul_sessions" ADD CONSTRAINT "soul_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soul_sessions" ADD CONSTRAINT "soul_sessions_subroutine_slug_fkey" FOREIGN KEY ("subroutine_slug") REFERENCES "subroutines"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soul_source_docs" ADD CONSTRAINT "soul_source_docs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soul_source_docs" ADD CONSTRAINT "soul_source_docs_subroutine_slug_fkey" FOREIGN KEY ("subroutine_slug") REFERENCES "subroutines"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debug_chat" ADD CONSTRAINT "debug_chat_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debug_chat_version" ADD CONSTRAINT "debug_chat_version_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_vector_stores" ADD CONSTRAINT "cycle_vector_stores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_vector_stores" ADD CONSTRAINT "cycle_vector_stores_subroutine_slug_fkey" FOREIGN KEY ("subroutine_slug") REFERENCES "subroutines"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_vector_stores_version" ADD CONSTRAINT "cycle_vector_stores_version_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_vector_stores_version" ADD CONSTRAINT "cycle_vector_stores_version_subroutine_slug_fkey" FOREIGN KEY ("subroutine_slug") REFERENCES "subroutines"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

