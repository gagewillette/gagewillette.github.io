# gagewillette.github.io

Personal developer blog built with React + Vite.

## What this site is now

This repository is set up as a clean, readable developer blog with:

- Home page for latest writing and project log entries.
- Posts index with category filters (`project` and `life`).
- Individual post pages.
- About page.
- Protected new-post route (`#/new` and `/new`) with Firebase Auth email/password login.
- Firebase Firestore-backed posts (with local seed fallback when Firebase is not configured).
- Hash-based routes for GitHub Pages compatibility (`#/posts`, `#/post/<slug>`, etc.).

## Local development

```bash
npm install
npm run dev
```

## Firebase setup

Copy `.env.example` to `.env` and fill in your Firebase values:

```bash
cp .env.example .env
```

Required:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional for Analytics features)

## Firestore data model

Collection: `posts`  
Document id: `slug`

Document shape:

```ts
{
  slug: string;
  title: string;
  excerpt: string;
  category: "project" | "life";
  date: "YYYY-MM-DD";
  tags: string[];
  blocks: Array<
    | { type: "paragraph"; text: string }
    | { type: "heading"; text: string }
    | { type: "list"; items: string[] }
    | { type: "quote"; text: string }
    | { type: "code"; code: string; language?: string }
  >;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Production build

```bash
npm run build
npm run preview
```

## How to publish a new post

1. Open `#/new` (on GitHub Pages this is the canonical route; direct `/new` is redirected to it).
2. Log in with Firebase Auth email/password.
3. Fill out title, slug, excerpt, category, date, tags, and content blocks.
4. Click `Publish Post`.

The app validates and normalizes slug/tags/blocks before writing to Firestore.

## Deployment

This is a Vite app, so deploy the `dist` directory.

If you use `gh-pages`, the command should target `dist`.
