import { describe, it, expect, afterAll } from "bun:test"
import { getPrismaClient } from "../src/prisma.ts"

describe("prisma works", () => {
  const prisma = getPrismaClient()

  afterAll(async () => {
    return prisma.$disconnect()
  })

  it("should connect", async () => {
    const cnt = await prisma.organizations.count()
    expect(cnt).toBeGreaterThan(1)
  })
})
