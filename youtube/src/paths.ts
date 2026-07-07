import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const srcDir = path.dirname(currentFile);

export const projectRoot = path.resolve(srcDir, "..");
export const publicDir = path.join(projectRoot, "public");
export const dataDir = path.join(projectRoot, "data");
export const storageDir = path.join(projectRoot, "storage");
export const multipartDir = path.join(storageDir, "multipart");
export const rawDir = path.join(storageDir, "raw");
export const processedDir = path.join(storageDir, "processed");
export const manifestsDir = path.join(storageDir, "manifests");
export const dbFile = path.join(dataDir, "videos.json");

export function multipartUploadDir(uploadId: string): string {
  return path.join(multipartDir, uploadId);
}

export function multipartPartPath(uploadId: string, partNumber: number): string {
  return path.join(multipartUploadDir(uploadId), `part-${String(partNumber).padStart(4, "0")}`);
}
