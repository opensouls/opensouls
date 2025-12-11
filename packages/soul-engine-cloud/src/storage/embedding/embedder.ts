
export type EmbedderOptions = {
  isQuery: boolean
  timeout?: number,
  organizationSlug?: string,
  organizationId?: string,
  blueprint?: string,
  bucket?: string,
  userId?: string
  model?: string
}

export type Embedder = (content: string, opts: EmbedderOptions) => Promise<number[]>
