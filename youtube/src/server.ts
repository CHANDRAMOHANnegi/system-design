import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { getVideo, getVideoByUploadId, listVideos, saveVideo } from "./db.js";
import { manifestsDir, processedDir, publicDir } from "./paths.js";
import { combineParts, ensureStorage, writePart } from "./storage.js";
import { enqueueProcessing } from "./worker.js";
import type { VideoRecord } from "./types.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: "1mb" }));
app.use(express.raw({ type: "application/octet-stream", limit: "50mb" }));
app.use(express.static(publicDir));
app.use("/media/processed", express.static(processedDir));

app.get("/api/videos", async (_request, response) => {
  response.json({ videos: await listVideos() });
});

app.post("/api/videos/upload/init", async (request, response) => {
  const { fileName, sizeBytes, partSizeBytes = 1024 * 512 } = request.body as {
    fileName?: string;
    sizeBytes?: number;
    partSizeBytes?: number;
  };

  if (!fileName || !sizeBytes) {
    response.status(400).json({ error: "fileName and sizeBytes are required" });
    return;
  }

  const videoId = nanoid(10);
  const uploadId = nanoid(14);
  const totalParts = Math.ceil(sizeBytes / partSizeBytes);
  const now = new Date().toISOString();

  const video: VideoRecord = {
    id: videoId,
    uploadId,
    fileName,
    sizeBytes,
    partSizeBytes,
    totalParts,
    status: "UPLOADING",
    createdAt: now,
    updatedAt: now,
    parts: Array.from({ length: totalParts }, (_value, index) => ({
      partNumber: index + 1,
      uploadUrl: `/api/object-storage/uploads/${uploadId}/parts/${index + 1}`,
      uploaded: false
    }))
  };

  await saveVideo(video);
  response.status(201).json({ video });
});

app.put("/api/object-storage/uploads/:uploadId/parts/:partNumber", async (request, response) => {
  const uploadId = request.params.uploadId;
  const partNumber = Number(request.params.partNumber);
  const video = await getVideoByUploadId(uploadId);

  if (!video) {
    response.status(404).json({ error: "Upload session not found" });
    return;
  }

  const part = video.parts.find((candidate) => candidate.partNumber === partNumber);
  if (!part) {
    response.status(404).json({ error: "Part not found" });
    return;
  }

  const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from([]);
  const { sizeBytes, etag } = await writePart(uploadId, partNumber, body);
  const updatedParts = video.parts.map((candidate) =>
    candidate.partNumber === partNumber
      ? { ...candidate, uploaded: true, sizeBytes, etag }
      : candidate
  );

  await saveVideo({ ...video, parts: updatedParts });
  response.setHeader("ETag", etag);
  response.json({ uploadId, partNumber, uploaded: true, sizeBytes, etag });
});

app.post("/api/videos/upload/:uploadId/complete", async (request, response) => {
  const video = await getVideoByUploadId(request.params.uploadId);

  if (!video) {
    response.status(404).json({ error: "Upload session not found" });
    return;
  }

  const missingParts = video.parts.filter((part) => !part.uploaded);
  if (missingParts.length > 0) {
    response.status(409).json({
      error: "Cannot complete upload until all parts are uploaded",
      missingParts: missingParts.map((part) => part.partNumber)
    });
    return;
  }

  const partsWithoutEtags = video.parts.filter((part) => !part.etag);
  if (partsWithoutEtags.length > 0) {
    response.status(409).json({
      error: "Cannot complete upload until every uploaded part has an ETag",
      partsWithoutEtags: partsWithoutEtags.map((part) => part.partNumber)
    });
    return;
  }

  const rawObjectKey = await combineParts(video);
  const uploadedVideo: VideoRecord = {
    ...video,
    status: "UPLOADED",
    rawObjectKey
  };

  await saveVideo(uploadedVideo);
  await enqueueProcessing(video.id);
  response.json({ video: uploadedVideo, next: "PROCESSING" });
});

app.get("/api/videos/:videoId", async (request, response) => {
  const video = await getVideo(request.params.videoId);
  if (!video) {
    response.status(404).json({ error: "Video not found" });
    return;
  }
  response.json({ video });
});

app.get("/api/videos/:videoId/manifest", async (request, response) => {
  const video = await getVideo(request.params.videoId);
  if (!video) {
    response.status(404).json({ error: "Video not found" });
    return;
  }

  if (video.status !== "READY") {
    response.status(409).json({ error: "Video is not ready yet", status: video.status });
    return;
  }

  const manifestPath = path.join(manifestsDir, `${video.id}.json`);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  response.json({ manifest });
});

await ensureStorage();

app.listen(port, () => {
  console.log(`YouTube system design lab running at http://localhost:${port}`);
});
