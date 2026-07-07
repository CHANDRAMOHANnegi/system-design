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
POST /api/shorten  -> create short URL
GET /api/links     -> see stored mappings
GET /:code         -> redirect to original URL
```

## Step 1 Code Map

```txt
package.json     -> project scripts and dependencies
tsconfig.json    -> TypeScript compiler settings
src/server.ts    -> Express API and in-memory URL storage
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

Next step: move the mapping into persistent storage so short links survive server restarts.
