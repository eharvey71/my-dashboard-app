#!/usr/bin/env node
/**
 * Pre-flight for deploying firestore.rules.
 *
 * The new rules require userId on every content document, and derive analytics
 * ownership from a "{userId}_{projectId}" document ID. Anything that predates
 * those conventions becomes unreadable the moment the rules go live. This
 * reports what would break, and writes nothing.
 *
 *   node functions/scripts/check-ownership-fields.cjs --project=mydashboard-ff9ae
 *
 * Pass --show to print the offending documents' contents.
 */
const admin = require("firebase-admin");

const projectArg = process.argv.find((a) => a.startsWith("--project="));
const show = process.argv.includes("--show");
admin.initializeApp(projectArg ? { projectId: projectArg.split("=")[1] } : {});
const db = admin.firestore();

const NEEDS_BOTH = ["tasks", "notes", "bookmarks", "documents", "synapses", "aiResponses"];

(async () => {
  let problems = 0;

  for (const name of [...NEEDS_BOTH, "projects"]) {
    const snapshot = await db.collection(name).get();
    const bad = snapshot.docs.filter((d) => {
      const data = d.data();
      if (!data.userId) return true;
      return NEEDS_BOTH.includes(name) && !data.projectId;
    });

    console.log(`${name}: ${snapshot.size} docs, ${bad.length} missing userId/projectId`);
    bad.slice(0, 10).forEach((d) => {
      console.log(`    ${name}/${d.id}`);
      if (show) console.log(`      ${JSON.stringify(d.data()).slice(0, 400)}`);
    });
    if (bad.length > 10) console.log(`    ...and ${bad.length - 10} more`);
    problems += bad.length;
  }

  const analytics = await db.collection("analytics").get();
  const badIds = analytics.docs.filter((d) => !d.id.includes("_"));
  console.log(`analytics: ${analytics.size} docs, ${badIds.length} not keyed {userId}_{projectId}`);
  badIds.slice(0, 10).forEach((d) => {
    console.log(`    analytics/${d.id}`);
    if (show) console.log(`      ${JSON.stringify(d.data()).slice(0, 400)}`);
  });
  problems += badIds.length;

  console.log(
    problems === 0
      ? "\nAll documents satisfy the new rules. Safe to deploy."
      : `\n${problems} documents would become unreadable. Fix or accept before deploying.`
  );
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
