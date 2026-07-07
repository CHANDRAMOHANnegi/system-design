import express from "express";

type LinkRecord = {
  code: string;
  longUrl: string;
  createdAt: string;
  clicks: number;
};

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

const linksByCode = new Map<string, LinkRecord>();
const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateCode(length = 6): string {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    code += alphabet[randomIndex];
  }

  return code;
}

function createUniqueCode(): string {
  let code = generateCode();

  while (linksByCode.has(code)) {
    code = generateCode();
  }

  return code;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

app.get("/", (_request, response) => {
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

  if (typeof longUrl !== "string" || !isValidHttpUrl(longUrl)) {
    response.status(400).json({
      error: "longUrl must be a valid http or https URL"
    });
    return;
  }

  const code = createUniqueCode();
  const record: LinkRecord = {
    code,
    longUrl,
    createdAt: new Date().toISOString(),
    clicks: 0
  };

  linksByCode.set(code, record);

  response.status(201).json({
    code,
    longUrl,
    shortUrl: `http://localhost:${port}/${code}`
  });
});

app.get("/api/links", (_request, response) => {
  response.json({
    links: Array.from(linksByCode.values())
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
  response.redirect(record.longUrl);
});

app.listen(port, () => {
  console.log(`URL shortener lab running on http://localhost:${port}`);
});
