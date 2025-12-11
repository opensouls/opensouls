import { Hono } from "hono"
import { ManifestBuilder } from "../storage/manifest.ts"
import { organizationFromSlug } from "./organizationIdFromSlug.ts"
import { VectorDb } from "../storage/vectorDb.ts"
import { Json } from "@opensouls/engine"
import { EventMetadata, trigger } from "../metrics.ts"
import { logger } from "../logger.ts"
import { blueprintBucketName, organizationBucketName } from "../lib/bucketNames.ts"
import { DEFAULT_EMBEDDING_MODEL } from "../storage/embedding/opensoulsEmbedder.ts"

const BASE_QUEUE_NAME = "store-integrate-"

interface TaskHandler {
  taskWorker: {
    addJob: (taskName: string, payload: any, opts: { jobKey: string, queueName: string, maxAttempts?: number }) => Promise<any>
  }
}

export interface StoreHandlerIntegration {
  key: string,
  content: string,
  metadata?: Record<string, Json>,
  embeddingModel?: string,
}

export interface StoreHandlerIntegrationJobParams extends StoreHandlerIntegration {
  _bucketName: string,
  _organizationId: string,
  _organizationSlug: string,
}

export const integrateOneStoreDoc = async (integration: StoreHandlerIntegrationJobParams) => {
  const start = performance.now()
  const db = new VectorDb()
  logger.info("inserting", { key: integration.key, length: integration.content.length, organizationId: integration._organizationId})
  try {
    await db.insert({
      organizationId: integration._organizationId,
      bucket: integration._bucketName,
      key: integration.key,
      content: integration.content,
      metadata: integration.metadata,
      embeddingModel: integration.embeddingModel || DEFAULT_EMBEDDING_MODEL,
    })
    trigger("integrate-store-doc", {
      organizationSlug: integration._organizationSlug,
      userId: "unkown",
      bucket: integration._bucketName,
      key: integration.key,
      duration: performance.now() - start,
      size: integration.content.length,
    })
  } catch (err) {
    logger.error("error inserting", { error: err, alert: false })
    throw err
  }
}

const handlePost = async ({
  organizationSlug,
  bucket,
  content,
  key,
  metadata,
  server,
  embeddingModel,
  _eventMetadata
}: {
  bucket: string,
  organizationSlug: string,
  key: string,
  content: string,
  metadata?: Record<string, Json>,
  server: TaskHandler,
  embeddingModel?: string,

  _eventMetadata?: EventMetadata,
}) => {

  trigger("post-store-handler", {
    organizationSlug,
    userId: "unknown",
    count: 1,
    size: content.length,
    ...(_eventMetadata || {}),
    bucket,
    key,
    embeddingModel,
  } as EventMetadata)

  const org = await organizationFromSlug(organizationSlug)
  if (!org) {
    logger.error("missing organization", { organizationSlug, alert: false })
    return new Response("missing org", { status: 400 }) //res.status(400).send({ error: "missing org" })
  }

  const payload: StoreHandlerIntegrationJobParams = {
    _bucketName: bucket,
    _organizationId: org.id,
    _organizationSlug: organizationSlug,
    key,
    content,
    metadata,
    embeddingModel,
  }

  await server.taskWorker.addJob(
    "integrateOneStoreDoc",
    payload,
    {
      // replace any jobs that are already pending for this rootKey
      jobKey: `${bucket}-${payload.key}`,
      queueName: `${BASE_QUEUE_NAME}_${organizationSlug}`,
      maxAttempts: 5,
    }
  )
}

const handleDelete = async ({
  organizationId,
  bucket,
  key,
}: {
  organizationId: string,
  bucket: string,
  key: string,
}) => {
  const db = new VectorDb()
  await db.delete({
    organizationId,
    bucket,
    key,
  })
}

const handleManifest = async ({
  bucket,
  organizationId,
}: {
  bucket: string,
  organizationId: string,
}) => {
  const manifestBuilder = new ManifestBuilder({
    name: bucket,
    organizationId,
  })
  return manifestBuilder.updateManifestFromDb()
}

const handleGet = async ({
  bucket,
  key,
  organizationId,
}: {
  key: string,
  bucket: string,
  organizationId: string,
}) => {
  const db = new VectorDb()
  const entry = await db.get({
    organizationId,
    bucket,
    key,
  })

  return entry
}


export const storeHandler = (app: Hono<any>, server: TaskHandler) => {
  // blueprint scoped buckets

  app.post("/api/:organizationSlug/stores/:blueprint/:bucketName", async (c) => {
    try {
      const organizationSlug = c.req.param("organizationSlug")
      const bucket = blueprintBucketName(c.req.param("blueprint"), c.req.param("bucketName"))

      const { key, content, metadata, embeddingModel } = await c.req.json() as StoreHandlerIntegration

      await handlePost({
        organizationSlug,
        bucket,
        key,
        content,
        metadata,
        server,
        embeddingModel,
        _eventMetadata: c.get("eventMetadata"),
      })

      return new Response("created", { status: 201 })
    } catch (err: any) {
      logger.error("error ingesting RAG", { error: err })
      return new Response("Something went wrong.", { status: 500 }) //res.status(500).send({ error: "Something went wrong." })
    }
  })

  app.delete("/api/:organizationSlug/stores/:blueprint/:bucketName/:key", async (c) => {
    const org = await organizationFromSlug(c.req.param("organizationSlug"))
    if (!org) {
      return new Response("Not found", { status: 404 })
    }

    await handleDelete({
      organizationId: org.id,
      bucket: blueprintBucketName(c.req.param("blueprint"), c.req.param("bucketName")),
      key: c.req.param("key"),
    })

    return new Response("OK", { status: 204 });
  })

  app.get("/api/:organizationSlug/stores/:blueprint/:bucketName", async (c) => {
    const org = await organizationFromSlug(c.req.param("organizationSlug"))
    if (!org) {
      return new Response("Not found", { status: 404 })
    }

    const manifest = await handleManifest({
      organizationId: org.id,
      bucket: blueprintBucketName(c.req.param("blueprint"), c.req.param("bucketName")),
    })

    return new Response(JSON.stringify(manifest), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })

  app.get("/api/:organizationSlug/stores/:blueprint/:bucketName/:key", async (c) => {
    const org = await organizationFromSlug(c.req.param("organizationSlug"))
    if (!org) {
      return new Response("Not found", { status: 404 })
    }

    const entry = await handleGet({
      organizationId: org.id,
      bucket: blueprintBucketName(c.req.param("blueprint"), c.req.param("bucketName")),
      key: c.req.param("key"),
    })

    if (!entry) {
      return new Response("Not found", { status: 404 })
    }

    return new Response(entry.content, { status: 200, headers: { 'Content-Type': 'application/json' } })
  })

  // these are organization wide buckets

  app.post("/api/:organizationSlug/stores/:bucketName", async (c) => {
    try {
      const organizationSlug = c.req.param("organizationSlug")
      const bucket = organizationBucketName(c.req.param("bucketName"))

      const { key, content, metadata } = await c.req.json() as StoreHandlerIntegration

      await handlePost({
        organizationSlug,
        bucket,
        key,
        content,
        metadata,
        server,
        _eventMetadata: c.get("eventMetadata"),
      })

      return new Response("created", { status: 201 })
    } catch (err: any) {
      logger.error("error ingesting RAG", { error: err })
      return new Response("Something went wrong.", { status: 500 }) //res.status(500).send({ error: "Something went wrong." })
    }
  })

  app.delete("/api/:organizationSlug/stores/:bucketName/:key", async (c) => {
    const org = await organizationFromSlug(c.req.param("organizationSlug"))
    if (!org) {
      return new Response("Not found", { status: 404 })
    }

    await handleDelete({
      organizationId: org.id,
      bucket: organizationBucketName(c.req.param("bucketName")),
      key: c.req.param("key"),
    })

    return new Response("OK", { status: 204 });
  })

  app.get("/api/:organizationSlug/stores/:bucketName", async (c) => {
    const org = await organizationFromSlug(c.req.param("organizationSlug"))
    if (!org) {
      return new Response("Not found", { status: 404 })
    }

    const manifest = await handleManifest({
      organizationId: org.id,
      bucket: organizationBucketName(c.req.param("bucketName")),
    })

    return new Response(JSON.stringify(manifest), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })

  app.get("/api/:organizationSlug/stores/:bucketName/:key", async (c) => {
    const org = await organizationFromSlug(c.req.param("organizationSlug"))
    if (!org) {
      return new Response("Not found", { status: 404 })
    }

    const entry = handleGet({
      organizationId: org.id,
      bucket: organizationBucketName(c.req.param("bucketName")),
      key: c.req.param("key"),
    })

    if (!entry) {
      return new Response("Not found", { status: 404 })
    }

    return new Response(JSON.stringify(entry), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })

}