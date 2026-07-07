const fileInput = document.querySelector("#fileInput");
const uploadButton = document.querySelector("#uploadButton");
const statusBox = document.querySelector("#statusBox");
const manifestBox = document.querySelector("#manifestBox");

const partSizeBytes = 512 * 1024;
const maxParallelUploads = 3;
const maxPartAttempts = 3;

function showStatus(value) {
  statusBox.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }
  return payload;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createChunkPlan(file, parts) {
  return parts.map((part) => {
    const start = (part.partNumber - 1) * partSizeBytes;
    const end = Math.min(start + partSizeBytes, file.size);
    return {
      ...part,
      start,
      end,
      chunk: file.slice(start, end)
    };
  });
}

async function uploadPartWithRetry(part, onProgress) {
  let lastError;

  for (let attempt = 1; attempt <= maxPartAttempts; attempt += 1) {
    try {
      const response = await fetch(part.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: part.chunk
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? `Part ${part.partNumber} failed`);
      }

      const etag = payload.etag ?? response.headers.get("ETag");
      onProgress({
        partNumber: part.partNumber,
        sizeBytes: payload.sizeBytes,
        etag,
        attempt
      });
      return { partNumber: part.partNumber, sizeBytes: payload.sizeBytes, etag };
    } catch (error) {
      lastError = error;
      if (attempt < maxPartAttempts) {
        await wait(250 * attempt);
      }
    }
  }

  throw lastError;
}

async function uploadChunksWithPool(file, video) {
  const pending = createChunkPlan(file, video.parts);
  const completedParts = [];
  let uploadedBytes = 0;

  async function worker(workerId) {
    while (pending.length > 0) {
      const part = pending.shift();
      if (!part) return;

      showStatus(
        `Worker ${workerId}: uploading part ${part.partNumber}/${video.totalParts} ` +
          `(${part.start}-${part.end} bytes)`
      );

      const uploadedPart = await uploadPartWithRetry(part, (progress) => {
        uploadedBytes += progress.sizeBytes;
        const percent = Math.round((uploadedBytes / file.size) * 100);
        showStatus({
          uploadId: video.uploadId,
          uploaded: `${completedParts.length + 1}/${video.totalParts}`,
          percent,
          latestPart: progress.partNumber,
          latestEtag: progress.etag,
          attempt: progress.attempt
        });
      });

      completedParts.push(uploadedPart);
    }
  }

  const workers = Array.from(
    { length: Math.min(maxParallelUploads, pending.length) },
    (_value, index) => worker(index + 1)
  );

  await Promise.all(workers);
  return completedParts.sort((left, right) => left.partNumber - right.partNumber);
}

async function pollUntilReady(videoId) {
  while (true) {
    const { video } = await requestJson(`/api/videos/${videoId}`);
    showStatus(video);

    if (video.status === "READY") return video;
    if (video.status === "FAILED") throw new Error(video.error ?? "Processing failed");

    await new Promise((resolve) => setTimeout(resolve, 700));
  }
}

async function renderManifest(videoId) {
  const { manifest } = await requestJson(`/api/videos/${videoId}/manifest`);
  manifestBox.innerHTML = "";

  const list = document.createElement("div");
  list.className = "segment-list";

  for (const quality of manifest.qualities) {
    const section = document.createElement("section");
    section.className = "quality";

    const heading = document.createElement("h3");
    heading.textContent = `${quality.label} - ${quality.bitrateKbps} kbps`;
    section.appendChild(heading);

    for (const segment of quality.segments) {
      const link = document.createElement("a");
      link.href = segment;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = segment.split("/").at(-1);
      section.appendChild(link);
    }

    list.appendChild(section);
  }

  manifestBox.appendChild(list);
}

uploadButton.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    showStatus("Choose a file first.");
    return;
  }

  uploadButton.disabled = true;
  manifestBox.textContent = "Waiting for processing...";

  try {
    const { video } = await requestJson("/api/videos/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        sizeBytes: file.size,
        partSizeBytes
      })
    });

    showStatus(video);

    const completedParts = await uploadChunksWithPool(file, video);

    const completed = await requestJson(`/api/videos/upload/${video.uploadId}/complete`, {
      method: "POST"
    });
    showStatus({ ...completed, completedParts });

    const readyVideo = await pollUntilReady(video.id);
    await renderManifest(readyVideo.id);
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Unknown error");
  } finally {
    uploadButton.disabled = false;
  }
});
