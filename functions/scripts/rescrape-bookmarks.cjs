#!/usr/bin/env node
/**
 * Re-scrape and embed existing bookmarks.
 *
 * Bookmark page text was only ever stored in Pinecone - Firestore keeps the
 * URL, title and image, nothing else - so the embedding backfill had nothing
 * local to work from and skipped every existing bookmark. This fetches each
 * page again and writes chunks to bookmarks/{id}/chunks/{index}, the same
 * shape the scrapeAndIndexBookmark trigger produces for new bookmarks.
 *
 * Safe to re-run: bookmarks that already have chunks are skipped, so an
 * interrupted run resumes where it stopped.
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   node functions/scripts/rescrape-bookmarks.cjs [--dry-run] [--project=<id>]
 */
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");

const EMBEDDING_MODEL = "text-embedding-ada-002";
const CHUNK_SIZE = 1000;
// Long pages would otherwise cost an unbounded number of embedding calls each.
const MAX_CHUNKS = 20;
const FETCH_TIMEOUT_MS = 15000;

const dryRun = process.argv.includes("--dry-run");
const projectArg = process.argv.find((a) => a.startsWith("--project="));
const projectId = projectArg ? projectArg.split("=")[1] : undefined;

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

admin.initializeApp(projectId ? { projectId } : {});
const db = admin.firestore();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const embed = async (text) => {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
};

const scrape = async (url) => {
  const response = await axios.get(url, {
    timeout: FETCH_TIMEOUT_MS,
    maxRedirects: 5,
    // Some sites refuse requests without a browser-ish UA.
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CognifyBot/1.0)" },
  });

  const $ = cheerio.load(response.data);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
};

(async () => {
  const snapshot = await db.collection("bookmarks").get();
  console.log(
    `${snapshot.size} bookmarks found.${dryRun ? " Dry run - nothing will be written." : ""}\n`
  );

  let done = 0;
  let skipped = 0;
  const failures = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const label = data.url || doc.id;

    if (!data.url || !data.userId || !data.projectId) {
      console.log(`skip  ${label} (missing url/userId/projectId)`);
      skipped++;
      continue;
    }

    const existing = await doc.ref.collection("chunks").limit(1).get();
    if (!existing.empty) {
      console.log(`skip  ${label} (already has chunks)`);
      skipped++;
      continue;
    }

    try {
      const text = await scrape(data.url);

      if (!text) {
        failures.push({ url: label, reason: "no text extracted" });
        continue;
      }

      const chunks = [];
      for (let i = 0; i < text.length && chunks.length < MAX_CHUNKS; i += CHUNK_SIZE) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
      }

      if (dryRun) {
        console.log(`would  ${label} -> ${chunks.length} chunks`);
        done++;
        continue;
      }

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await embed(chunks[i]);

        // userId and projectId are denormalised onto each chunk so the
        // collection-group vector query can pre-filter on them.
        await doc.ref.collection("chunks").doc(String(i)).set({
          userId: data.userId,
          projectId: data.projectId,
          url: data.url,
          chunkIndex: i,
          content: chunks[i],
          embedding: FieldValue.vector(embedding),
        });
      }

      await doc.ref.update({
        embedded: true,
        chunkCount: chunks.length,
        embeddingError: FieldValue.delete(),
      });

      console.log(`ok    ${label} -> ${chunks.length} chunks`);
      done++;
    } catch (error) {
      const reason = error.response
        ? `HTTP ${error.response.status}`
        : error.message;
      failures.push({ url: label, reason });

      if (!dryRun) {
        await doc.ref.update({ embedded: false, embeddingError: reason });
      }
    }
  }

  console.log(`\n${done} scraped, ${skipped} skipped, ${failures.length} failed`);

  if (failures.length) {
    console.log("\nFailed (dead links, paywalls, and bot blocks are expected):");
    for (const f of failures) {
      console.log(`  ${f.url}\n    ${f.reason}`);
    }
  }

  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
