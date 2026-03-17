# gagewillette.github.io

Personal developer blog built with React + Vite.

## What this site is now

This repository is set up as a clean, readable developer blog with:

- Home page for latest writing and project log entries.
- Posts index with category filters (`project` and `life`).
- Individual post pages.
- About page.
- Protected editor routes (`#/new` and `#/edit/<slug>`) with Firebase Auth email/password login.
- Firebase Firestore-backed posts for both reading and publishing.
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

If those values are present, the app reads blog posts from the Firestore `posts` collection and the local editor routes publish directly into that same collection.

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
  markdown: string;
  contentFormat: "markdown";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Legacy posts that still store `blocks` remain readable in the app, and saving them again rewrites the document into the Markdown schema above.

## Production build

```bash
npm run build
npm run preview
```

## Local-only editor access

The login form and authoring tools are only available when both of these are true:

- The app is running in Vite dev mode.
- The browser hostname is localhost (`localhost`, `127.0.0.1`, or `::1`).

On the deployed site, users cannot log in, create posts, or edit posts.

## How to publish or edit a post

1. Run the app locally with `npm run dev`.
2. Open `#/new` to create a post, or open `#/edit/<slug>` to edit an existing one.
3. Log in with Firebase Auth email/password.
4. Fill out or update title, slug, excerpt, category, date, tags, and the Markdown body.
5. Click `Publish Post` or `Save Changes`.

The app validates and normalizes slug, tags, and Markdown content before writing to Firestore.

## Deployment

This is a Vite app, so deploy the `dist` directory.

If you use `gh-pages`, the command should target `dist`.
