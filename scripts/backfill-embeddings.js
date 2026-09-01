#!/usr/bin/env node
/**
 * One-time backfill: embed existing content into Firestore.
 *
 * Documents written before the move off Pinecone have no `embedding` field, so
 * querySimilarContent cannot see them. This walks every searchable collection,
 * embeds anything missing or stale, and writes the vector onto the document.
 *
 * Safe to re-run: documents whose embeddedHash already matches their content
 * are skipped, so an interrupted run resumes where it stopped.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   export OPENAI_API_KEY=sk-...
 *   node scripts/backfill-embeddings.js [--dry-run] [--project=<id>]
 */
const crypto = require("crypto");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const OpenAI = require("openai");

const SEARCHABLE = ["notes", "tasks", "documents"];
const EMBEDDING_MODEL = "text-embedding-ada-002";
const CHUNK_SIZE = 1000;

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

const contentHash = (text) =>
  crypto.createHash("sha256").update(text).digest("hex");

const embed = async (text) => {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
};

async function backfillCollection(name) {
  const snapshot = await db.collection(name).get();
  let embedded = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const content = data.content || data.title || "";

    if (!content.trim() || !data.userId || !data.projectId) {
      skipped++;
      continue;
    }

    const hash = contentHash(content);
    if (data.embeddedHash === hash) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  would embed ${name}/${doc.id}`);
      embedded++;
      continue;
    }

    try {
      const vector = await embed(content);
      await doc.ref.update({
        embedding: FieldValue.vector(vector),
        embeddedHash: hash,
        embeddedAt: FieldValue.serverTimestamp(),
        embedded: true,
      });
      embedded++;
    } catch (error) {
      console.error(`  failed ${name}/${doc.id}:`, error.message);
    }
  }

  console.log(`${name}: ${embedded} embedded, ${skipped} skipped`);
}

// Bookmarks store their scraped text as chunks in a subcollection. Only
// bookmarks that already have scraped text can be backfilled; ones that never
// scraped successfully need re-adding so the onCreate trigger runs again.
async function backfillBookmarks() {
  const snapshot = await db.collection("bookmarks").get();
  let embedded = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const existing = await doc.ref.collection("chunks").limit(1).get();

    if (!existing.empty) {
      skipped++;
      continue;
    }

    const text = (data.scrapedContent || data.description || "").trim();
    if (!text || !data.userId || !data.projectId) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  would chunk bookmarks/${doc.id}`);
      embedded++;
      continue;
    }

    try {
      for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        const chunk = text.slice(i, i + CHUNK_SIZE);
        const index = i / CHUNK_SIZE;
        const vector = await embed(chunk);

        await doc.ref.collection("chunks").doc(String(index)).set({
          userId: data.userId,
          projectId: data.projectId,
          url: data.url,
          chunkIndex: index,
          content: chunk,
          embedding: FieldValue.vector(vector),
        });
      }
      await doc.ref.update({ embedded: true });
      embedded++;
    } catch (error) {
      console.error(`  failed bookmarks/${doc.id}:`, error.message);
    }
  }

  console.log(`bookmarks: ${embedded} chunked, ${skipped} skipped`);
}

(async () => {
  console.log(dryRun ? "Dry run - nothing will be written.\n" : "Backfilling.\n");
  for (const name of SEARCHABLE) {
    await backfillCollection(name);
  }
  await backfillBookmarks();
  console.log("\nDone.");
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
