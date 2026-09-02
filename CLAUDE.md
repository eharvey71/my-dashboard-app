# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What this is

**Cognify** (`my-dashboard-app`) — a personal, project-scoped productivity dashboard.
Every piece of content belongs to a **project**; a project aggregates tasks, notes,
bookmarks, rich-text documents, focus-timer sessions, and AI conversations.

The distinguishing feature is **Synapse**: a user-curated bundle of items (tasks,
notes, bookmarks, documents) that is handed to an LLM as a working context. The AI
Assistant answers against a Synapse rather than against the whole workspace, and
answers can be saved back as `aiResponses` and re-included in later prompts.

Content is also embedded by Cloud Functions and stored **on the Firestore
document it describes**, giving a semantic-search path (`querySimilarContent`)
alongside the explicit Synapse path.

## Stack

| Layer | Choice |
|---|---|
| Build | Vite 5, ESM (`"type": "module"`) |
| UI | React 18, React Router 6, Bootstrap 5 + CSS Modules, `lucide-react` icons |
| Data/auth | Firebase v10 (Firestore + vector search, Auth, Callable Functions), `react-firebase-hooks` |
| Backend | Firebase Cloud Functions, Node 20, 1st-gen API (`firebase-functions` v5) |
| AI | OpenAI (`gpt-3.5-turbo` / `gpt-4`, `text-embedding-ada-002`) |
| Editor | TinyMCE via `@tinymce/tinymce-react`, `marked` / `react-markdown` |
| Charts / DnD | `recharts`, `react-beautiful-dnd` |
| Hosting | Firebase Hosting, SPA rewrite to `/index.html`, serves `dist/` |

## Commands

```bash
npm install            # root deps
npm run dev            # Vite dev server
npm run build          # production build -> dist/
npm run preview        # serve the built bundle
npm run lint           # eslint . --ext js,jsx --max-warnings 0  (see caveat below)

cd functions && npm install
npm run serve          # firebase emulators:start --only functions
npm run deploy         # firebase deploy --only functions
npm run logs           # firebase functions:log

firebase deploy --only hosting   # from repo root, after npm run build
```

### Lint caveat

`.eslintrc.cjs` is **eslintrc (v8) format**. If ESLint 9+ resolves ahead of the
pinned `^8.57.0` (e.g. a globally installed binary), it will fail with
"couldn't find an eslint.config.js". Always run the local binary:
`./node_modules/.bin/eslint . --ext js,jsx`.

`npm run lint` uses `--max-warnings 0` and **currently fails** — the repo has a
large standing backlog (~419 errors / 12 warnings, almost all `react/prop-types`
and `no-unused-vars`). See "Known issues" before assuming a lint failure is
something you introduced.

## Layout

```
src/
  App.jsx                 Auth gate + all routing (no route-level code splitting)
  main.jsx                ReactDOM.render entry (legacy React 17 API — see below)
  lazyComponents.js       DEAD CODE: lazy wrappers, never imported anywhere
  components/             ~45 components, colocated *.module.css
  contexts/
    ProjectContext.jsx    Current project + project list
    TimerContext.jsx      Focus/Pomodoro timer state, shared with TimerOverlay
  services/
    firebaseApp.js        The single initializeApp; exports app/db/functions/auth
    firebaseConfig.js     ALL Firestore CRUD (the hub)
    firebaseAuth.js       Auth helpers
    synapseService.js     Synapse CRUD + content hydration
    externalServices.js   Bookmark metadata via the fetchLinkMetadata callable
    googleDriveService.js gapi/GIS picker for importing Drive docs
  utils/versionManager.js Cache-bust + "stuck loading" auto-reload heuristics
functions/index.js        1076 lines, all Cloud Functions in one file
```

### Routes

All app routes are project-scoped:

```
/login  /auth/email-link  /setup-profile  /projects  /account
/project/:projectId
/project/:projectId/{notes|tasks|bookmarks|documents|focus|synapses|ai-assistant}
/project/:projectId/documents/{new|:id}
/project/:projectId/ai-assistant/:synapseId
```

`App.jsx` boot order: `onAuthStateChanged` → user doc + projects **in parallel**
→ redirect via `getRedirectPath()` (`/login` → `/setup-profile` → `/projects` →
last project). Protected routes are only *mounted* when `user && displayNameSet`;
a catch-all `path="*"` route sends anything unmatched back through
`getRedirectPath()`.

**Nothing external belongs on that path.** First render used to wait on
`googleDriveInitialized`, which meant five serial round trips to Google before
any pixel appeared. Google Drive now loads on demand via
`ensureGoogleDriveApi()` (memoised; entry points await it). Keep it that way —
if you add a startup dependency, put it behind the first render, not in front
of it.

### Firestore collections

`users`, `projects`, `tasks`, `notes`, `bookmarks`, `documents`, `synapses`,
`aiResponses`, plus analytics/focus-session data. Nearly every document carries
`userId` + `projectId`; queries always filter on both. Generic CRUD lives in
`addItem` / `getItems` / `updateItem` / `deleteItem` in `firebaseConfig.js`,
with thin typed wrappers (`addTask`, `getNotes`, …) on top.

### Cloud Functions

Triggers: `indexSearchableContent` (onWrite over `{collectionName}/{docId}`,
embeds notes/tasks/documents), `scrapeAndIndexBookmark` (bookmark onCreate →
scrape → chunk → embed), `cleanupBookmarkChunks` (bookmark onDelete).

Callables: `querySimilarContent`, `analyzeContent`, `generateSuggestions`,
`convertTasksToDocument`, `analyzeSynapseContent`, `fetchLinkMetadata`. All
callables check `context.auth` and throw `functions.https.HttpsError` on
failure, and derive `userId` from `context.auth.uid` — never from the payload.

Secrets use `defineSecret` from `firebase-functions/params`, bound per function
via `runWith(AI_SECRETS)` / `runWith(LINK_SECRETS)` and resolved at call time:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set LINKPREVIEW_API_KEY
```

### Embeddings and search

Embeddings live **on the document they describe**, in an `embedding` field of
Firestore's `VectorValue` type. Deleting a note deletes its embedding; there is
no second store to reconcile. Supporting fields:

| Field | Meaning |
|---|---|
| `embedding` | `FieldValue.vector([...])`, 1536 dims (ada-002) |
| `embeddedHash` | sha256 of the content the vector was built from |
| `embedFailedHash` | sha256 of content that failed to embed |
| `embedded` | boolean, surfaced in the notes UI |

`indexSearchableContent` writes the embedding back onto the same document,
which re-fires the trigger. **Both hash fields are loop guards** — the trigger
returns early when either matches the current content. Never remove those
checks; without them a permanent failure retries forever at one OpenAI call
per pass.

Bookmarks are the exception: scraped page text is too long for one vector, so
chunks live in `bookmarks/{id}/chunks/{index}`, each carrying a denormalised
`userId`/`projectId` so the collection-group query can pre-filter. Firestore
does not cascade deletes into subcollections, which is why
`cleanupBookmarkChunks` exists.

**Vector indexes are created with `gcloud`, not `firebase.json`** — run
`scripts/create-vector-indexes.sh` once per environment. A missing index makes
that one collection silently return nothing (the query catches and logs it, so
the rest of the search still works).

`querySimilarContent` runs one `findNearest` per collection, then ranks the
merged results by cosine similarity computed in-process — `findNearest` in
`@google-cloud/firestore` 7.x returns matches without their distances.

`functions/scripts/backfill-embeddings.cjs` embeds pre-existing content. It is idempotent
(skips anything whose `embeddedHash` already matches) and supports `--dry-run`.

## Conventions

- Function components + hooks only; no class components except `ErrorBoundary`.
- CSS Modules (`styles.foo`) for component styles; Bootstrap for layout primitives;
  a few global stylesheets (`index.css`, `DashboardModule.css`, `FullPageBookmarks.css`).
- New Firestore access goes in `src/services/`, not inline in components.
- Path aliases exist: `@` → `src/`, `services` → `src/services/` (rarely used;
  most imports are relative).
- Every Firestore query must filter by `userId` **and** `projectId`.
- Prefer callable Cloud Functions over calling OpenAI from the browser.
- Adding a searchable collection means adding it to `SEARCHABLE` in
  `functions/index.js` **and** creating its vector index via the script.

## Known issues

These are pre-existing. Do not treat them as regressions, and prefer fixing them
deliberately over incidentally.

1. **Leaked keys are still live in git history.** They were removed from `HEAD`,
   but the OpenAI, Pinecone, LinkPreview, Google OAuth client secret, and TinyMCE
   keys remain in commits up to `b6e291e`. **Rotation at each provider is the
   fix** — deleting them from source does not revoke them. The Firebase web
   `apiKey` in `firebaseApp.js` is public by design and is fine.
2. **`firestore.rules` has never been deployed, and vector indexes are not created.** The rules file now exists and is
   registered in `firebase.json`, but it was reconstructed from the data model,
   not exported from the console — the live rules may differ. Test it in the
   emulator or the console Rules Playground before `firebase deploy --only
   firestore:rules`, or you can lock yourself out. Separately,
   `scripts/create-vector-indexes.sh` has never been run against a real project
   — until it is, `querySimilarContent` returns nothing.
3. **`main.jsx` uses `ReactDOM.render`**, the React 17 API. React 18 runs in
   legacy mode — no concurrent features, and `StrictMode` behaves differently.
   Migrating to `createRoot` may surface double-invoke effects and
   `react-beautiful-dnd` breakage (that library is unmaintained and
   StrictMode-incompatible; `Synapse.jsx` is what will break).
4. **No code splitting.** `App.jsx` wraps routes in `Suspense` but imports every
   component eagerly, so the `Suspense` boundaries are inert and the main chunk
   is **~1.59 MB** (505 kB gzipped). `src/lazyComponents.js` was written to fix
   this and never wired up — finishing it is the cheapest large win available.
5. **Lint backlog:** ~317 `react/prop-types`, ~88 `no-unused-vars`,
   10 `react-hooks/exhaustive-deps`. `no-undef` is now clean.
6. **Dead / unreferenced files:** `lazyComponents.js`, `Signup.orig.js`,
   `Signup.jsx`, `Login.jsx`, `MinimalLogin.jsx`, `Bookmark.jsx`,
   `CreateProject.jsx`, `EmailVerification.jsx`, `Journal.jsx`,
   `PomodoroTimer.jsx`, `TypingIndicator.jsx`. `AIAssistant.jsx` and
   `CustomAPIModule.jsx` are imported-but-commented-out in `Dashboard.jsx`.
   `axios` remains a frontend dependency solely for `CustomAPIModule.jsx`.
7. **No tests, no CI.** No test runner is installed and there is no `.github/`.

### Recently fixed — do not "re-fix"

- Pinecone is gone. Embeddings moved onto the Firestore documents themselves,
  which removed `cleanupPineconeVectors`, `retryFailedIndexing`, the
  `PINECONE_API_KEY` secret, and the whole orphaned-vector problem class.
- Client-side OpenAI/Pinecone/LinkPreview calls are now Cloud Functions
  callables; `aiService.js` and `pineconeService.js` are gone.
- Documents are now embedded on write, including ones created in the editor.
- `functions.config()` replaced with `defineSecret`; the load-time
  `process.exit(1)` is gone.
- Three different Pinecone vector-ID schemes (client, trigger, retry job) meant
  duplicate and orphaned vectors, and `cleanupPineconeVectors` deleted every
  document embedding on every run. All moot now, but do not reintroduce a
  second store without a plan for reconciliation.
- `versionManager.js` no longer reloads on the word "Loading"; it checks whether
  `#root` mounted and retries at most once per session.
- `public/index.html` (Firebase scaffold) deleted.
- One `initializeApp` in `firebaseApp.js` instead of two.
- First render no longer blocks on the Google Drive API, boot does two parallel
  Firestore reads instead of three serial ones (`getLastAccessedProject` was
  re-reading the user document already in memory), and the profile-setup hop no
  longer does a `window.location.href` full page reload.

## Working agreements

- Do **not** add new API keys to source. Use `import.meta.env.VITE_*` for public
  client config, and a Cloud Function for anything that must stay secret.
- Do **not** run mass lint autofix across the repo — the backlog is large and a
  sweeping change buries real diffs. Fix lint in the files you touch.
- `npm run build` must stay green; that is the effective smoke test until tests exist.
- Firestore schema changes need matching security rules (see issue 2).
