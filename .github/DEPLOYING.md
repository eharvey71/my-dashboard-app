# Deploying without a local machine

Everything below happens in a browser: GitHub's web UI, the Firebase console,
and [Google Cloud Shell](https://shell.cloud.google.com) (a terminal in a tab
with `gcloud`, `firebase` and `node` already installed — nothing to install).

## One-time setup

### 1. Rotate the leaked keys

The OpenAI, Pinecone, LinkPreview, Google OAuth and TinyMCE keys are in git
history up to `b6e291e`. Removing them from the code did not revoke them —
rotate each at its provider. Pinecone can simply be deleted; nothing uses it.

### 2. Create a deploy service account

Google Cloud console → IAM & Admin → Service Accounts → **Create**.

Grant these roles:

| Role | Needed for |
|---|---|
| Firebase Hosting Admin | hosting + preview channels |
| Cloud Functions Admin | deploying functions |
| Service Account User | functions run as a service account |
| Secret Manager Secret Accessor | functions reading their secrets |
| Firebase Rules Admin | deploying firestore.rules (optional) |

Then **Keys → Add key → JSON**. Download it; you need its contents once, below.

### 3. Add GitHub secrets

Repo → Settings → Secrets and variables → Actions → **New repository secret**.

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the entire contents of that JSON file |
| `VITE_TINYMCE_API_KEY` | rotated TinyMCE key |
| `VITE_WEATHER_API_KEY` | existing weather key |
| `VITE_GOOGLE_CLIENT_ID` | `890654183832-nf837a379aq9nu8h0h4ugd6lqhi66m4e.apps.googleusercontent.com` |
| `VITE_GOOGLE_API_KEY` | leave empty unless you create a referrer-restricted browser key |

The `VITE_*` values are inlined into the bundle and are public by construction.
They live in secrets to keep them out of the repo, not because they are
confidential. **Never put an OAuth client secret (`GOCSPX-…`) here.**

### 4. Set the Cloud Functions secrets

These are real secrets and never touch the frontend. In Cloud Shell:

```bash
firebase functions:secrets:set OPENAI_API_KEY --project mydashboard-ff9ae
firebase functions:secrets:set LINKPREVIEW_API_KEY --project mydashboard-ff9ae
```

Or via Google Cloud console → Security → Secret Manager → Create secret, using
those exact names.

### 5. Create the Firestore vector indexes

In Cloud Shell:

```bash
git clone https://github.com/eharvey71/my-dashboard-app.git
cd my-dashboard-app
./scripts/create-vector-indexes.sh
gcloud firestore indexes composite list --project=mydashboard-ff9ae
```

Builds are asynchronous. Semantic search returns nothing until they finish;
everything else works meanwhile.

## Deploying

### Test on the web

Push to any branch, or use **Actions → Deploy → Run workflow**. The frontend
goes to a temporary preview channel and the run summary prints a URL like
`https://mydashboard-ff9ae--<branch>-<hash>.web.app`, live for 30 days.

**A preview channel shares the real backend.** It hits the same Firestore and
the same Cloud Functions as production — it is a preview of the frontend only,
not an isolated environment.

### Deploying Cloud Functions

Actions → Deploy → Run workflow → tick **Also deploy Cloud Functions**.

Do this *before* previewing a frontend that expects new callables, or the
preview will fail on anything that calls one.

Afterwards, delete the functions that no longer exist in the source — Firebase
leaves removed functions running. In Cloud Shell:

```bash
firebase functions:delete queryPinecone indexTaskOrNote cleanupPineconeVectors \
  retryFailedIndexing indexContent updateVector deleteVector \
  --project mydashboard-ff9ae
```

### Going live

Merge to `main`. That deploys to the live hosting site.

## Firestore rules — do this one by hand

`firestore.rules` was reconstructed from the data model, not exported from the
console, so the live rules may differ. Wrong rules can lock you out of your own
data, and there is no one-click undo.

1. Firebase console → Firestore → Rules. **Copy the current rules somewhere
   safe first** — that is your rollback.
2. Paste the contents of `firestore.rules` into the Rules Playground and test a
   few real document paths.
3. Publish from the console when it behaves.

## Backfilling embeddings

Existing content has no `embedding` field and is invisible to search until
backfilled. In Cloud Shell:

```bash
export OPENAI_API_KEY=sk-...
node scripts/backfill-embeddings.js --dry-run    # count first
node scripts/backfill-embeddings.js
```

Cloud Shell is already authenticated, so no service-account file is needed. The
script is idempotent — re-running skips anything already embedded.

## Rolling back

| What | How |
|---|---|
| Hosting | Firebase console → Hosting → previous release → **Rollback** |
| Functions | Run the workflow from `main` with functions enabled |
| Rules | Paste your saved rules back into the console |
| Backfill | Nothing to undo — it only adds fields |
