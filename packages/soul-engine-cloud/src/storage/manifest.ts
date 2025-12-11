import { VectorDb } from "./vectorDb.ts"

export interface BucketMetadata {
  name: string,
  organizationId: string,
  blueprintId?: string,
}

export interface RecordEntry {
  key: string,
  contentHash: string, // Buffer?
}

export type BucketEntries = Record<string, RecordEntry>

export interface ManifestDoc {
  bucket: BucketMetadata,
  entries: BucketEntries,
}

export class ManifestBuilder {
  private manifestDoc: ManifestDoc
  private db: VectorDb

  constructor(public bucketMetadata: BucketMetadata) {
    this.manifestDoc = {
      bucket: bucketMetadata,
      entries: {},
    }
    this.db = new VectorDb()
  }

  get manifest() {
    return this.manifestDoc
  }

  async updateManifestFromDb() {
    if (!this.manifestDoc.bucket.organizationId || !this.manifestDoc.bucket.name) {
      throw new Error("missing org id or bucket name")
    }
    const entries = await this.db.getEntries({
      organizationId: this.manifestDoc.bucket.organizationId,
      bucket: this.manifestDoc.bucket.name,
    })

    entries.forEach(entry => {
      this.manifestDoc.entries[entry.key] = {
        key: entry.key,
        contentHash: entry.content_hash?.toString('hex') || "?",
      }
    })

    return this.manifestDoc
  }
}
