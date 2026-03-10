export const blogTitle = "Gage Willette";
export const blogDescription =
  "Posts and project notes pulled from Firestore, with a lightweight editor for publishing new entries.";

export type PostCategory = "life" | "project";

export type PostBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string; language?: string };

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: PostCategory;
  date: string;
  tags: string[];
  blocks: PostBlock[];
}

// Firestore is the canonical store. This empty list keeps the app bootable
// when Firebase env vars are not present during local development.
export const posts: BlogPost[] = [];
