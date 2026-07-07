export type VideoStatus =
  | "UPLOADING"
  | "UPLOADED"
  | "PROCESSING"
  | "READY"
  | "FAILED";

export type UploadPart = {
  partNumber: number;
  uploadUrl: string;
  uploaded: boolean;
  sizeBytes?: number;
  etag?: string;
};

export type VideoRecord = {
  id: string;
  uploadId: string;
  fileName: string;
  sizeBytes: number;
  partSizeBytes: number;
  totalParts: number;
  status: VideoStatus;
  parts: UploadPart[];
  createdAt: string;
  updatedAt: string;
  rawObjectKey?: string;
  manifestKey?: string;
  error?: string;
};

export type Manifest = {
  videoId: string;
  source: string;
  qualities: Array<{
    label: "360p" | "720p" | "1080p";
    bitrateKbps: number;
    segments: string[];
  }>;
};
