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

## Step 3: Code Generation And Collisions

The short code is the small ID in the URL:

```txt
http://localhost:3001/nH9uER
                      ^^^^^^
                      short code
```

Our app creates a 6-character random code from this alphabet:

```txt
a-z A-Z 0-9
```

That gives 62 possible characters for each position.

For a 6-character code:

```txt
62 * 62 * 62 * 62 * 62 * 62 = 56,800,235,584 possible codes
```

That is a lot, but collisions are still possible.

A collision means:

```txt
Generated code: nH9uER
But nH9uER already exists in storage.
```

So the server must not blindly accept the generated code.

The safe flow is:

```txt
1. Generate a code
2. Check if code already exists
3. If it exists, generate again
4. Stop after a max number of attempts
```

In our code:

```txt
generateCode()      -> creates a random code
createUniqueCode()  -> keeps trying until the code is unused
```

`POST /api/shorten` now returns `generationAttempts` so you can see how many tries were needed.

Example:

```json
{
  "code": "nH9uER",
  "generationAttempts": 1,
  "longUrl": "https://example.com",
  "shortUrl": "http://localhost:3001/nH9uER"
}
```

Most of the time it will be `1`.

To see a forced collision demo:

```bash
curl -s -X POST http://localhost:3001/api/debug/collision-demo
```

You should see:

```json
{
  "message": "The first generated code already existed, so the server tried again.",
  "existingCode": "DEMO01",
  "selectedCode": "DEMO02",
  "generationAttempts": 2
}
```

Learning point:

```txt
Random generation is simple.
Uniqueness comes from checking storage.
```

Next step: custom aliases, such as choosing `/my-link` instead of a random code.
