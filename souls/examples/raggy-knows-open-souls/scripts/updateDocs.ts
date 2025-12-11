#!/usr/bin/env npx tsx

import { mkdirp, emptyDir, copy } from "fs-extra/esm";
import { glob } from "glob";
import path from "node:path"

async function copyMDXFiles() {
  
  // Delete all files in the backgroundInformation directory
  await emptyDir('./backgroundInformation');
  await mkdirp('./backgroundInformation');
  
  // Define the source and destination directories
  const sourceDir = '../../docs/pages/';
  const destinationDir = './backgroundInformation/';

  // Recursively find all .mdx files in the source directory
  const mdxFiles = glob.sync(path.join(sourceDir, '**/*.mdx'));

  // Copy each found .mdx file to the destination directory
  for (const file of mdxFiles) {
    const destinationFilePath = path.join(destinationDir, path.relative(sourceDir, file));
    await copy(file, destinationFilePath);
  }
  
}

// Call the function to perform the copy operation
await copyMDXFiles();
