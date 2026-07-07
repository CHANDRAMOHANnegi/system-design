import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type LinkRecord = {
  code: string;
  longUrl: string;
  createdAt: string;
  clicks: number;
};

type CodeResult = {
  code: string;
  attempts: number;
};

const app = express();
const port = Number(process.env.PORT ?? 3000);
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const publicDir = path.join(currentDir, "..", "public");
const dataDir = path.join(currentDir, "..", "data");
const linksFile = path.join(dataDir, "links.json");

app.use(express.json());
app.use(express.static(publicDir));

const linksByCode = new Map<string, LinkRecord>();
const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const maxCodeGenerationAttempts = 10;
const customAliasPattern = /^[a-zA-Z0-9_-]{3,32}$/;

function ensureDataFile(): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(linksFile)) {
    fs.writeFileSync(linksFile, "[]\n");
  }
}

function loadLinks(): void {
  ensureDataFile();

  const rawJson = fs.readFileSync(linksFile, "utf8");
  const links = JSON.parse(rawJson) as LinkRecord[];

  linksByCode.clear();

  for (const link of links) {
    linksByCode.set(link.code, link);
  }
}

function saveLinks(): void {
  ensureDataFile();

  const links = Array.from(linksByCode.values());
  fs.writeFileSync(linksFile, `${JSON.stringify(links, null, 2)}\n`);
}

function generateCode(length = 6): string {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    code += alphabet[randomIndex];
  }

  return code;
}

function createUniqueCode(length = 6, codeGenerator = generateCode): CodeResult {
  let attempts = 1;
  let code = codeGenerator(length);

  while (linksByCode.has(code)) {
    if (attempts >= maxCodeGenerationAttempts) {
      throw new Error("Could not create a unique short code");
    }

    attempts += 1;
    code = codeGenerator(length);
  }

  return {
    code,
    attempts
  };
}

function normalizeAlias(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function validateCustomAlias(alias: string): string | undefined {
  if (!customAliasPattern.test(alias)) {
    return "customAlias must be 3-32 characters and use only letters, numbers, hyphen, or underscore";
  }

  if (linksByCode.has(alias)) {
    return "customAlias is already taken";
  }

  return undefined;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

app.get("/api", (_request, response) => {
  response.json({
    name: "URL Shortener Learning Lab",
    routes: {
      createShortUrl: "POST /api/shorten",
      listLinks: "GET /api/links",
      redirect: "GET /:code"
    }
  });
});

app.post("/api/shorten", (request, response) => {
  const longUrl = request.body?.longUrl;
  const customAlias = normalizeAlias(request.body?.customAlias);

  if (typeof longUrl !== "string" || !isValidHttpUrl(longUrl)) {
    response.status(400).json({
      error: "longUrl must be a valid http or https URL"
    });
    return;
  }

  if (customAlias) {
    const aliasError = validateCustomAlias(customAlias);

    if (aliasError) {
      response.status(409).json({
        error: aliasError
      });
      return;
    }
  }

  const codeResult = customAlias
    ? { code: customAlias, attempts: 0 }
    : createUniqueCode();
  const record: LinkRecord = {
    code: codeResult.code,
    longUrl,
    createdAt: new Date().toISOString(),
    clicks: 0
  };

  linksByCode.set(codeResult.code, record);
  saveLinks();

  response.status(201).json({
    code: codeResult.code,
    codeType: customAlias ? "custom" : "random",
    generationAttempts: codeResult.attempts,
    longUrl,
    shortUrl: `http://localhost:${port}/${codeResult.code}`
  });
});

app.get("/api/links", (_request, response) => {
  response.json({
    links: Array.from(linksByCode.values())
  });
});

app.post("/api/debug/collision-demo", (_request, response) => {
  const existingCode = "DEMO01";
  const fallbackCode = "DEMO02";

  if (!linksByCode.has(existingCode)) {
    linksByCode.set(existingCode, {
      code: existingCode,
      longUrl: "https://example.com/already-taken",
      createdAt: new Date().toISOString(),
      clicks: 0
    });
  }

  const forcedCodes = [existingCode, fallbackCode];
  const result = createUniqueCode(6, () => forcedCodes.shift() ?? generateCode());

  response.json({
    message: "The first generated code already existed, so the server tried again.",
    existingCode,
    selectedCode: result.code,
    generationAttempts: result.attempts
  });
});

app.get("/:code", (request, response) => {
  const record = linksByCode.get(request.params.code);

  if (!record) {
    response.status(404).json({
      error: "Short URL not found"
    });
    return;
  }

  record.clicks += 1;
  saveLinks();
  response.redirect(record.longUrl);
});

loadLinks();

app.listen(port, () => {
  console.log(`URL shortener lab running on http://localhost:${port}`);
});
