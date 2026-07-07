import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import {
  manifestsDir,
  multipartDir,
  multipartPartPath,
  processedDir,
  rawDir,
  storageDir
} from "./paths.js";
import type { Manifest, VideoRecord } from "./types.js";

export async function ensureStorage(): Promise<void> {
  await Promise.all([
    fs.mkdir(storageDir, { recursive: true }),
    fs.mkdir(multipartDir, { recursive: true }),
    fs.mkdir(rawDir, { recursive: true }),
    fs.mkdir(processedDir, { recursive: true }),
    fs.mkdir(manifestsDir, { recursive: true })
  ]);
}

export function partPath(uploadId: string, partNumber: number): string {
  return multipartPartPath(uploadId, partNumber);
}

export function rawVideoPath(videoId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(rawDir, `${videoId}-${safeName}`);
}

export async function writePart(
  uploadId: string,
  partNumber: number,
  body: Buffer
): Promise<{ sizeBytes: number; etag: string }> {
  const destination = partPath(uploadId, partNumber);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, body);
  return {
    sizeBytes: body.byteLength,
    etag: crypto.createHash("md5").update(body).digest("hex")
  };
}

export async function combineParts(video: VideoRecord): Promise<string> {
  const destination = rawVideoPath(video.id, video.fileName);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rm(destination, { force: true });

  const output = await fs.open(destination, "w");
  try {
    for (const part of video.parts) {
      const chunk = await fs.readFile(partPath(video.uploadId, part.partNumber));
      await output.write(chunk);
    }
  } finally {
    await output.close();
  }

  return destination;
}

export async function createProcessedVideo(video: VideoRecord): Promise<Manifest> {
  const qualities: Manifest["qualities"] = [
    { label: "360p", bitrateKbps: 800, segments: [] },
    { label: "720p", bitrateKbps: 2500, segments: [] },
    { label: "1080p", bitrateKbps: 5000, segments: [] }
  ];

  for (const quality of qualities) {
    const qualityDir = path.join(processedDir, video.id, quality.label);
    await fs.mkdir(qualityDir, { recursive: true });

    for (let index = 1; index <= 3; index += 1) {
      const segmentName = `segment-${index}.txt`;
      const segmentPath = path.join(qualityDir, segmentName);
      await fs.writeFile(
        segmentPath,
        `Fake ${quality.label} video segment ${index} for ${video.fileName}\n`
      );
      quality.segments.push(`/media/processed/${video.id}/${quality.label}/${segmentName}`);
    }
  }

  const manifest: Manifest = {
    videoId: video.id,
    source: video.fileName,
    qualities
  };

  await fs.mkdir(manifestsDir, { recursive: true });
  await fs.writeFile(
    path.join(manifestsDir, `${video.id}.json`),
    JSON.stringify(manifest, null, 2)
  );

  return manifest;
}
