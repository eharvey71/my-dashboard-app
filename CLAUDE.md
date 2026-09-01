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

Content is also indexed into Pinecone (embeddings) by Cloud Functions, giving a
RAG path (`queryPinecone`) alongside the explicit Synapse path.

## Stack

| Layer | Choice |
|---|---|
| Build | Vite 5, ESM (`"type": "module"`) |
| UI | React 18, React Router 6, Bootstrap 5 + CSS Modules, `lucide-react` icons |
| Data/auth | Firebase v10 (Firestore, Auth, Callable Functions), `react-firebase-hooks` |
| Backend | Firebase Cloud Functions, Node 20, 1st-gen API (`firebase-functions` v5) |
| AI | OpenAI (`gpt-3.5-turbo` / `gpt-4`, `text-embedding-ada-002`), Pinecone |
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
large standing backlog (~461 errors / 12 warnings). See "Known issues" before
assuming a lint failure is something you introduced.

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
    firebaseConfig.js     Firebase init + ALL Firestore CRUD (570 lines, the hub)
    firebaseAuth.js       Auth helpers; re-initializes its own Firebase app
    synapseService.js     Synapse CRUD + content hydration
    pineconeService.js    Direct browser -> Pinecone calls (see security note)
    aiService.js          Direct browser -> OpenAI embeddings (see security note)
    externalServices.js   LinkPreview.net bookmark metadata
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

`App.jsx` boot order: `onAuthStateChanged` → load user doc + projects → redirect via
`getRedirectPath()` (`/login` → `/setup-profile` → `/projects` → last project).
Protected routes are only *mounted* when `user && displayNameSet`, so an unknown
path for a signed-out user renders nothing rather than redirecting.

### Firestore collections

`users`, `projects`, `tasks`, `notes`, `bookmarks`, `documents`, `synapses`,
`aiResponses`, plus analytics/focus-session data. Nearly every document carries
`userId` + `projectId`; queries always filter on both. Generic CRUD lives in
`addItem` / `getItems` / `updateItem` / `deleteItem` in `firebaseConfig.js`,
with thin typed wrappers (`addTask`, `getNotes`, …) on top.

### Cloud Functions

Triggers: `scrapeAndIndexBookmark` (bookmark onCreate → scrape → chunk → embed →
Pinecone), `indexTaskOrNote`, scheduled `cleanupPineconeVectors` and
`retryFailedIndexing`.

Callables: `queryPinecone`, `analyzeContent`, `generateSuggestions`,
`convertTasksToDocument`, `analyzeSynapseContent`. All callables check
`context.auth` and throw `functions.https.HttpsError` on failure.

Secrets come from `functions.config().openai.key` / `.pinecone.key` / `.pinecone.index`.
The module **calls `process.exit(1)` at load time** if any are missing.

## Conventions

- Function components + hooks only; no class components except `ErrorBoundary`.
- CSS Modules (`styles.foo`) for component styles; Bootstrap for layout primitives;
  a few global stylesheets (`index.css`, `DashboardModule.css`, `FullPageBookmarks.css`).
- New Firestore access goes in `src/services/`, not inline in components.
- Path aliases exist: `@` → `src/`, `services` → `src/services/` (rarely used;
  most imports are relative).
- Every Firestore query must filter by `userId` **and** `projectId`.
- Prefer callable Cloud Functions over calling OpenAI/Pinecone from the browser.

## Known issues (as of the last commit, `b6e291e`)

These are pre-existing. Do not treat them as regressions, and prefer fixing them
deliberately over incidentally.

1. **Committed secrets.** Live-looking keys are hardcoded in the repo:
   `src/services/aiService.js` (OpenAI `sk-proj-…`), `pineconeService.js` (Pinecone),
   `googleDriveService.js` (a Google OAuth **client secret**, `GOCSPX-…`, wrongly
   passed as `apiKey`), `externalServices.js` (LinkPreview), and a TinyMCE key in
   `DocumentEditor.jsx`. They are in git history, so rotation — not deletion — is
   the fix. The Firebase web `apiKey` in `firebaseConfig.js`/`firebaseAuth.js` is
   public by design and is fine.
2. **No `firestore.rules` in the repo** and no `firestore` block in `firebase.json`.
   Rules are only whatever is live in the console — unversioned and unreviewable.
   Since the client writes directly to Firestore, this is the security boundary.
3. **`main.jsx` uses `ReactDOM.render`**, the React 17 API. React 18 runs in legacy
   mode — no concurrent features, and `StrictMode` behaves differently. Migrating to
   `createRoot` may surface double-invoke effects and `react-beautiful-dnd` breakage
   (that library is unmaintained and StrictMode-incompatible).
4. **No code splitting.** `App.jsx` wraps routes in `Suspense` but imports every
   component eagerly, so the `Suspense` boundaries are inert and the main chunk is
   **~1.94 MB** (595 kB gzipped). `src/lazyComponents.js` was written to fix this
   and never wired up.
5. **Lint backlog:** 321 `react/prop-types`, 94 `no-unused-vars`, 34 `no-undef`
   (all `gapi`/`google` globals, plus `__dirname` in `vite.config.js`),
   10 `react-hooks/exhaustive-deps`.
6. **`versionManager.js` reload heuristics are risky.** After 8 s it reloads the page
   if `document.body.textContent.includes('Loading')` — any page with the word
   "Loading" in it can trigger a reload loop.
7. **`public/index.html` is the stock Firebase Hosting scaffold.** Vite copies
   `public/` into `dist/`; the real `index.html` currently wins, but the file is a
   deployment footgun and should be deleted.
8. **Dead / unreferenced files:** `lazyComponents.js`, `Signup.orig.js`, `Signup.jsx`,
   `Login.jsx`, `MinimalLogin.jsx`, `Bookmark.jsx`, `CreateProject.jsx`,
   `EmailVerification.jsx`, `Journal.jsx`, `PomodoroTimer.jsx`, `TypingIndicator.jsx`.
   `AIAssistant.jsx` and `CustomAPIModule.jsx` are imported-but-commented-out in
   `Dashboard.jsx`.
9. **`pineconeService.deleteVectors` is broken** — `while (true)` with an unused
   `filterCondition`, and Pinecone `query()` has no `cursor` parameter.
10. **Stray root deps:** `build@^0.1.4` (unused) and `firebase-functions` in the
    frontend `dependencies`.
11. **Two Firebase app initializations** — `firebaseConfig.js` and `firebaseAuth.js`
    each call `initializeApp` with the same config.
12. **No tests, no CI.** No test runner is installed and there is no `.github/`.

## Working agreements

- Do **not** add new API keys to source. Use `import.meta.env.VITE_*` for public
  client config, and a Cloud Function for anything that must stay secret.
- Do **not** run mass lint autofix across the repo — the backlog is large and a
  sweeping change buries real diffs. Fix lint in the files you touch.
- `npm run build` must stay green; that is the effective smoke test until tests exist.
- Firestore schema changes need matching security rules (see issue 2).
