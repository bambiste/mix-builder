import * as fs from 'fs';
import * as path from 'path';

/**
 * Copy a file to another directory (basic synchronous version)
 */
export function copyFileSync(sourcePath, destDir) {
  // Ensure destination directory exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Get the filename from source path
  const fileName = path.basename(sourcePath);
  const destPath = path.join(destDir, fileName);

  // Copy the file
  fs.copyFileSync(sourcePath, destPath);
}

/**
 * Copy a file to another directory (asynchronous version with Promises)
 */
export async function copyFileAsync(sourcePath, destDir) {
  // Ensure destination directory exists
  await fs.promises.mkdir(destDir, { recursive: true });

  // Get the filename from source path
  const fileName = path.basename(sourcePath);
  const destPath = path.join(destDir, fileName);

  // Copy the file
  await fs.promises.copyFile(sourcePath, destPath);
}
