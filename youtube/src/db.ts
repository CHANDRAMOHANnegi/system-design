import fs from "node:fs/promises";
import { dataDir, dbFile } from "./paths.js";
import type { VideoRecord } from "./types.js";

type DatabaseShape = {
  videos: VideoRecord[];
};

async function readDatabase(): Promise<DatabaseShape> {
  try {
    const raw = await fs.readFile(dbFile, "utf8");
    return JSON.parse(raw) as DatabaseShape;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") throw error;
    return { videos: [] };
  }
}

async function writeDatabase(database: DatabaseShape): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbFile, JSON.stringify(database, null, 2));
}

export async function listVideos(): Promise<VideoRecord[]> {
  const database = await readDatabase();
  return database.videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getVideo(id: string): Promise<VideoRecord | undefined> {
  const database = await readDatabase();
  return database.videos.find((video) => video.id === id);
}

export async function getVideoByUploadId(uploadId: string): Promise<VideoRecord | undefined> {
  const database = await readDatabase();
  return database.videos.find((video) => video.uploadId === uploadId);
}

export async function saveVideo(video: VideoRecord): Promise<void> {
  const database = await readDatabase();
  const index = database.videos.findIndex((existing) => existing.id === video.id);
  const nextVideo = { ...video, updatedAt: new Date().toISOString() };

  if (index === -1) {
    database.videos.push(nextVideo);
  } else {
    database.videos[index] = nextVideo;
  }

  await writeDatabase(database);
}
