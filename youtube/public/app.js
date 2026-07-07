const fileInput = document.querySelector("#fileInput");
const uploadButton = document.querySelector("#uploadButton");
const statusBox = document.querySelector("#statusBox");
const manifestBox = document.querySelector("#manifestBox");

const partSizeBytes = 512 * 1024;

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

    for (const part of video.parts) {
      const start = (part.partNumber - 1) * partSizeBytes;
      const end = Math.min(start + partSizeBytes, file.size);
      const chunk = file.slice(start, end);

      await fetch(part.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk
      });

      showStatus(`Uploaded part ${part.partNumber}/${video.totalParts}`);
    }

    const completed = await requestJson(`/api/videos/upload/${video.uploadId}/complete`, {
      method: "POST"
    });
    showStatus(completed);

    const readyVideo = await pollUntilReady(video.id);
    await renderManifest(readyVideo.id);
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Unknown error");
  } finally {
    uploadButton.disabled = false;
  }
});
