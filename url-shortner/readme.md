# URL Shortener System Design

We will build this step by step using Node.js, Express, and TypeScript.

The goal is not only to make a working app. The goal is to understand why each part exists.

## Step 1: Core Idea

A URL shortener stores a mapping from a short code to a long URL.

```txt
short code -> long URL
```

Example:

```txt
aB91xZ -> https://example.com/some/very/long/path
```

When someone opens:

```txt
http://localhost:3000/aB91xZ
```

The server does:

```txt
1. Read the short code from the URL: aB91xZ
2. Find the long URL stored for that code
3. Redirect the browser to the long URL
```

So the first version only needs three things:

```txt
GET /              -> open browser preview
POST /api/shorten  -> create short URL
GET /api/links     -> see stored mappings
GET /:code         -> redirect to original URL
```

## Step 1 Code Map

```txt
package.json     -> project scripts and dependencies
tsconfig.json    -> TypeScript compiler settings
src/server.ts    -> Express API and in-memory URL storage
public/index.html -> browser preview
public/app.js     -> calls the API from the browser
public/styles.css -> preview styling
```

## Run Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

If port `3000` is already busy:

```bash
PORT=3001 npm run dev
```

Create a short URL:

```bash
curl -s \
  -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"longUrl":"https://example.com/some/very/long/path"}'
```

You will get a response like:

```json
{
  "code": "aB91xZ",
  "longUrl": "https://example.com/some/very/long/path",
  "shortUrl": "http://localhost:3000/aB91xZ"
}
```

Then open the short URL in the browser.

## What We Are Learning First

The first version uses an in-memory `Map`.

That means the data lives only inside the running server process:

```txt
Server running -> links exist
Server stopped -> links are lost
```

This is good for learning the flow, but not enough for a real product.

## Step 2: Persistent Storage

Now the server saves links to a local JSON file:

```txt
data/links.json
```

The flow becomes:

```txt
Server starts
  -> read data/links.json
  -> load links into memory

POST /api/shorten
  -> create short code
  -> save mapping in memory
  -> write full list back to data/links.json

GET /:code
  -> find mapping in memory
  -> increment click count
  -> write updated click count to data/links.json
  -> redirect browser
```

So we still use a `Map` for fast lookup while the server is running, but the source of truth now survives restarts.

This local JSON file is not what a production system would use, but it teaches the storage boundary clearly.

Production systems usually replace `data/links.json` with a database such as PostgreSQL, MySQL, DynamoDB, or Cassandra.

## Step 2 Code Map

The important functions in `src/server.ts` are:

```txt
ensureDataFile() -> creates data/links.json if missing
loadLinks()      -> reads saved links when server starts
saveLinks()      -> writes latest links after create/click
```

Learning point:

```txt
Memory is fast, but temporary.
Storage is slower, but durable.
```

Next step: talk about short-code generation, collisions, and why 6 random characters may or may not be enough.
