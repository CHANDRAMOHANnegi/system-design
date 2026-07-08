# YouTube System Design Lab

This project is a local Node + Express + TypeScript simulation of the YouTube upload pipeline, based on the Hello Interview YouTube breakdown:

https://www.hellointerview.com/learn/system-design/problem-breakdowns/youtube

The goal is to make HLD concepts visible:

- app server as the control plane
- object storage as the data plane
- presigned URLs
- multipart upload
- metadata DB
- async video processing
- manifests and segmented playback

## What This Maps To

The Hello Interview article frames YouTube around two core requirements:

```text
1. Users can upload videos.
2. Users can watch/stream videos.
```

This lab focuses on the most important senior-level parts:

```text
Upload path:
large file -> presigned multipart upload -> object storage -> metadata update

Processing path:
raw video -> split into segments -> transcode into formats -> create manifest

Watch path:
metadata -> manifest -> choose quality -> fetch small segments
```

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Architecture

```text
Browser
  -> Express API: create upload session
  -> Fake Object Storage: upload parts directly
  -> Express API: complete upload

Express API
  -> JSON metadata DB
  -> Fake Object Storage
  -> Processing worker

Worker
  -> reads raw video
  -> creates fake processed segments
  -> creates manifest
  -> marks video READY
```

## API Map

```text
POST /api/videos/upload/init
  Creates a VideoMetadata record and returns one upload URL per part.

PUT /api/object-storage/uploads/:uploadId/parts/:partNumber
  Simulates direct upload to object storage.

POST /api/videos/upload/:uploadId/complete
  Combines uploaded parts into one raw object and starts processing.

GET /api/videos/:videoId
  Fetches metadata/status.

GET /api/videos/:videoId/manifest
  Returns the manifest after processing completes.
```

## Frontend Chunking

The browser does not automatically split the file for us. Our frontend JavaScript uses the browser File/Blob API to create a chunk plan:

```text
file -> file.slice(start, end) -> 512 KB chunks in this lab
```

Then it uploads chunks through a small worker pool:

```text
3 parallel PUT requests -> fake object storage
failed chunk -> retry only that chunk
successful chunk -> store partNumber + ETag
```

The important boundary:

```text
Frontend owns chunking, parallelism, progress, retry, and ETag collection.
Backend owns upload session, upload URLs, ETag verification, completion, and metadata state.
```

In real AWS terms:

```text
PUT /api/object-storage/... = uploading directly to S3 with presigned URLs
storage/raw = S3 raw object
storage/processed = S3 processed segments
storage/manifests = S3 manifest files
src/worker.ts = video processing service / DAG simulator
data/videos.json = video metadata DB
```

## Learning Notes

For small metadata, it is fine to use:

```text
Client -> App Server -> DB
```

For large video bytes, this is bad:

```text
Client -> App Server -> Object Storage
```

The app server becomes a middleman for huge traffic.

Better:

```text
Client -> App Server: ask permission
App Server -> Client: return temporary upload URLs
Client -> Object Storage: upload video bytes directly
Object Storage/API -> Worker: process uploaded video
```

Interview sentence:

```text
The app server should stay on the control path, not the heavy data path.
```

## Video Quality Concepts

There are two different pixel systems:

```text
screen pixels = physical pixels in device hardware
video pixels  = pixels inside the video frame/file
```

Screen resolution is decided mostly by hardware:

```text
phone: 2532x1170
laptop: 1920x1080
4K TV: 3840x2160
```

Video resolution is decided by the video stream:

```text
360p  = 640x360
720p  = 1280x720
1080p = 1920x1080
4K    = 3840x2160
```

When video plays, the player maps video pixels to screen pixels.

If the video has more pixels than the player area:

```text
4K video -> 720p player area
many video pixels -> one screen pixel
```

This is downscaling.

If the video has fewer pixels than the player area:

```text
720p video -> 4K player area
one video pixel -> many screen pixels
```

This is upscaling.

Clean mental model:

```text
device resolution = display capacity
video resolution  = source detail
player size       = area where video is shown
scaling           = mapping video pixels to screen pixels
bitrate           = data budget per second
fps               = video frames per second
Hz                = screen refresh rate
```

FPS and refresh rate are related but different:

```text
60 fps video = video provides 60 frames every second
60 Hz screen = screen refreshes 60 times every second
```

YouTube creates multiple versions like 360p, 720p, 1080p, and 4K with different bitrates so the player can choose the best stream based on screen, network, device, and user setting.
