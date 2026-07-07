import path from "node:path";
import { createProcessedVideo } from "./storage.js";
import { getVideo, saveVideo } from "./db.js";

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function enqueueProcessing(videoId: string): Promise<void> {
  void processVideo(videoId);
}

async function processVideo(videoId: string): Promise<void> {
  const video = await getVideo(videoId);
  if (!video) return;

  try {
    await saveVideo({ ...video, status: "PROCESSING" });

    await sleep(1500);
    const manifest = await createProcessedVideo(video);

    const latest = await getVideo(videoId);
    if (!latest) return;

    await saveVideo({
      ...latest,
      status: "READY",
      manifestKey: path.basename(`${manifest.videoId}.json`)
    });
  } catch (error) {
    const latest = await getVideo(videoId);
    if (!latest) return;

    await saveVideo({
      ...latest,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown worker error"
    });
  }
}
