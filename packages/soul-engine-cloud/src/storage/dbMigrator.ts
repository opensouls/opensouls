import { getPrismaClient } from "../prisma.ts";
import { storeBytesToVolume } from "../hocusPocusPersistence/volumeDoc.ts";

export async function migrateOneDoc(docName: string) {
  const prisma = getPrismaClient();

  try {
    const doc = await prisma.debug_chat_version.findUnique({
      where: { name: docName }
    });

    if (doc && doc.state) {
      const stateBuffer = Buffer.from(doc.state);
      const byteSize = stateBuffer.length;

      // Store bytes to volume
      await Promise.all([
        storeBytesToVolume(doc.name, stateBuffer),
      ]);

      // Update the row in the database
      await prisma.debug_chat_version.update({
        where: { name: doc.name },
        data: {
          byte_size: BigInt(byteSize),
          state: null
        }
      });

      console.log(`Migrated document: ${doc.name}, size: ${byteSize} bytes`);
    }
  } catch (error) {
    console.error(`Error migrating document ${docName}:`, error);
  }
}

export async function migrateDocumentsToVolume(numberOfDocuments: number) {
  const prisma = getPrismaClient();

  try {
    // Fetch documents from debug_chat_versions table
    const documents = await prisma.debug_chat_version.findMany({
      take: numberOfDocuments,
      where: {
        state: {
          not: null
        }
      },
      orderBy: {
        created_at: 'asc' // TODO: this is good when we're slowly testing, but maybe want to start from most recent when actually runnning
      },
    });

    console.log(`Found ${documents.length} documents to migrate.`);

    for (const doc of documents) {
      await migrateOneDoc(doc.name);
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}
