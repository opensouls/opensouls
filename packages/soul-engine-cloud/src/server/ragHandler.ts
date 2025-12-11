import { ALLOWED_RAG_FILE_EXTENSIONS, VectorMetadata } from "@opensouls/engine";
import { RAG } from "../rag/rag.ts";
import { organizationFromSlug } from "./organizationIdFromSlug.ts";
import { VectorDb } from "../storage/vectorDb.ts";
import { EventMetadata, trigger } from "../metrics.ts";
import { Hono } from "hono";
import { SoulServer } from "./server.ts";
import { extname } from "node:path";
import { logger } from "../logger.ts";

interface RagIngestionBody {
  rootKey: string
  content: string // base64 encoded binary data
  contentType?: string
  maxTokens?: number
  metadata?: VectorMetadata
}

export interface RagIngestion {
  bucket: string
  organizationId: string
  organizationSlug: string
  ingestion: RagIngestionBody
}

const MAX_CONCURRENCY = 20

const BASE_QUEUE_NAME = "rag-ingestion-"

export const ingestOneDocument = async ({ bucket, organizationId, organizationSlug, ingestion }: RagIngestion) => {

  const start = new Date().getTime()
  const rag = new RAG({
    bucket,
    organizationId: organizationId,
    vectorDb: new VectorDb(),
  })

  await rag.ingest({
    rootKey: ingestion.rootKey,
    content: ingestion.content,
    maxTokens: ingestion.maxTokens,
  })

  trigger("ingest-rag-doc", {
    organizationSlug,
    userId: "unknown",
    bucket,
    rootKey: ingestion.rootKey,
    size: ingestion.content.length,
    duration: new Date().getTime() - start,
  })
}

export const ragIngestionHandler = (app: Hono<any>, server: SoulServer) => {
  app.post("/api/:organizationSlug/rag-ingest/:bucket", async (c) => {
    try {
      const ingestions = await c.req.json() as RagIngestionBody[]
      const organizationSlug = c.req.param("organizationSlug")
      const bucket = c.req.param("bucket")

      trigger("write-rag-files", {
        organizationSlug,
        userId: "unknown",
        count: ingestions.length,
        size: ingestions.reduce((acc, i) => acc + i.content.length, 0),
        ...(c.get("eventMetadata") || {}),
        bucket,
        
      } as EventMetadata)

      const org = await organizationFromSlug(organizationSlug)
      if (!org) {
        logger.error("No org in ragIngestionHandler", { organizationSlug })
        return new Response("missing org", { status: 400 }) //res.status(400).send({ error: "missing org" })
      }

      await Promise.all(ingestions.map(async (ingestion) => {
        if (!ALLOWED_RAG_FILE_EXTENSIONS.includes(extname(ingestion.rootKey))) {
          logger.warn("Invalid file extension", { organizationSlug, bucket, rootKey: ingestion.rootKey })
          return
        }

        const payload: RagIngestion ={
          bucket,
          organizationSlug,
          organizationId: org.id,
          ingestion: {
            ...ingestion,
            content: Buffer.from(ingestion.content, "base64").toString("utf-8"),
          }
        }

        return server.taskWorker.addJob(
          "ingestOneRagDoc",
          payload,
          {
            // replace any jobs that are already pending for this rootKey
            jobKey: `${bucket}-${ingestion.rootKey}`,
            // since a queue is run sequentially, this basically means that our entire app will max out
            // the RAG concurrency to MAX_CONCURRENCY, and all ingested docs get dropped into these buckets
            // this is a naieve strategy, but should be pretty effective on text documents.
            queueName: BASE_QUEUE_NAME + Math.floor(Math.random() * MAX_CONCURRENCY),
          }
        )
      }))

      // this will no longer be accurate for *processing* - we need a manifest to keep track of this.
      if (bucket.startsWith("__blueprint-rag-")) {
        const blueprint = bucket.split("-").slice(2).join("-")
        server.broadcastRagUpdate(organizationSlug, blueprint)
      }

      return new Response("created", { status: 201 }) //
    } catch (err: any) {
      logger.error("error ingesting RAG", { error: err })
      return new Response("Something went wrong.", { status: 500 }) //res.status(500).send({ error: "Something went wrong." })
    }
  })
}
