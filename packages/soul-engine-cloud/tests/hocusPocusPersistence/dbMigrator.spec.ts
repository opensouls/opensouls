import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { migrateOneDoc } from "../../src/storage/dbMigrator.ts";
import { getPrismaClient } from "../../src/prisma.ts";
import { v4 as uuidv4 } from "uuid";
import { fetch } from "../../src/hocusPocusPersistence/yjsDocumentPersister.ts";

describe("dbMigrator", () => {
  const prisma = getPrismaClient();
  let organizationId: string;

  beforeAll(async () => {
    organizationId = uuidv4();
    await prisma.organizations.upsert({
      where: { id: organizationId },
      update: {},
      create: {
        id: organizationId,
        name: "test organization",
        slug: `test-organization-${organizationId}`,
      },
    });
  });

  afterAll(async () => {
    // Delete the test organization
    await prisma.organizations.delete({
      where: { id: organizationId },
    });
  });

  it("migrates documents from debug_chat_version to volume", async () => {
    // Create a test document in debug_chat_version
    const testDocName = "test-doc-" + Date.now();
    const testState = Buffer.from("Test state");
    await prisma.debug_chat_version.create({
      data: {
        name: testDocName,
        state: testState,
        organization_id: organizationId,
        subroutine_slug: "test-subroutine",
      },
    });

    // Run the migration
    await migrateOneDoc(testDocName);

    // Check if the original document in debug_chat_version was updated
    const updatedDoc = await prisma.debug_chat_version.findUnique({
      where: { name: testDocName },
    });
    expect(updatedDoc?.state).toBeNull();
    expect(updatedDoc?.byte_size).toBe(BigInt(testState.length));

    // load the doc and make sure we can fetch the state
    const bits = await fetch({ documentName: testDocName });
    expect(bits).toEqual(testState);

    // Clean up
    await prisma.debug_chat_version.delete({
      where: { name: testDocName },
    });
  });
});
