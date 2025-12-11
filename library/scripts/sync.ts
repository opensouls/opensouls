import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const pathToSync = join(process.cwd(), 'src')

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY environment variables must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadFile(filePath: string, bucketName: string) {
  const fileContent = await readFile(filePath);
  const fileName = relative(pathToSync, filePath);

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, fileContent, {
      upsert: true,
    });

  if (error) {
    console.error(`Error uploading ${fileName}:`, error);
  } else {
    console.log(`Successfully uploaded ${fileName}`);
  }
}

async function syncDirectory(dir: string, bucketName: string) {
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = join(dir, file.name);
    if (filePath.includes('node_modules') || file.name === '.env') {
      continue; // Skip paths with node_modules and .env files
    }
    if (file.isDirectory()) {
      await syncDirectory(filePath, bucketName);
    } else {
      await uploadFile(filePath, bucketName);
    }
  }
}

async function main() {
  const bucketName = 'engine-library';
  const currentDir = pathToSync;

  try {
    await syncDirectory(currentDir, bucketName);
    console.log('Directory sync completed successfully');
  } catch (error) {
    console.error('Error syncing directory:', error);
  }
}

main();
