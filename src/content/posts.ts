export const blogTitle = "Gage Willette";
export const blogDescription =
  "Posts and project notes pulled from Firestore, with a lightweight editor for publishing new entries.";

export type PostCategory = "life" | "project";

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: PostCategory;
  date: string;
  tags: string[];
  markdown: string;
}

// Firestore is the canonical store. This empty list keeps the app bootable
// when Firebase env vars are not present during local development.
export const posts: BlogPost[] = [];
