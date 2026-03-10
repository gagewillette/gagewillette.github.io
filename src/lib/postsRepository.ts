import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { posts as fallbackPosts, type BlogPost, type PostBlock, type PostCategory } from "../content/posts";
import { db, isFirebaseConfigured } from "./firebase";

type UnknownRecord = Record<string, unknown>;

const postsCollectionName = "posts";
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export interface CreatePostInput {
  slug: string;
  title: string;
  excerpt: string;
  category: PostCategory;
  date: string;
  tags: string[];
  blocks: PostBlock[];
}

export const sortPostsByDate = (items: BlogPost[]): BlogPost[] => {
  return [...items].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
};

export const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const normalizeTags = (tags: string[]): string[] => {
  return [...new Set(tags.map((tag) => tag.toLowerCase().trim()).filter(Boolean))];
};

const isObject = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null;
};

const isPostCategory = (value: unknown): value is PostCategory => {
  return value === "life" || value === "project";
};

const parseStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }
  return value;
};

const parsePostBlock = (value: unknown): PostBlock | null => {
  if (!isObject(value) || typeof value.type !== "string") {
    return null;
  }

  if (value.type === "paragraph" || value.type === "heading" || value.type === "quote") {
    if (typeof value.text !== "string") {
      return null;
    }
    return { type: value.type, text: value.text.trim() };
  }

  if (value.type === "list") {
    const items = parseStringArray(value.items);
    if (!items) {
      return null;
    }
    return {
      type: "list",
      items: items.map((item) => item.trim()).filter(Boolean),
    };
  }

  if (value.type === "code") {
    if (typeof value.code !== "string") {
      return null;
    }

    return {
      type: "code",
      code: value.code,
      language: typeof value.language === "string" ? value.language.trim() : undefined,
    };
  }

  return null;
};

const parsePost = (value: unknown): BlogPost | null => {
  if (!isObject(value)) {
    return null;
  }

  if (
    typeof value.slug !== "string" ||
    typeof value.title !== "string" ||
    typeof value.excerpt !== "string" ||
    !isPostCategory(value.category) ||
    typeof value.date !== "string" ||
    !dateRegex.test(value.date)
  ) {
    return null;
  }

  const tags = parseStringArray(value.tags);
  const rawBlocks = Array.isArray(value.blocks) ? value.blocks : null;
  if (!tags || !rawBlocks) {
    return null;
  }

  const blocks = rawBlocks.map((block) => parsePostBlock(block)).filter((block): block is PostBlock => block !== null);
  if (blocks.length === 0) {
    return null;
  }

  return {
    slug: slugify(value.slug),
    title: value.title.trim(),
    excerpt: value.excerpt.trim(),
    category: value.category,
    date: value.date,
    tags: normalizeTags(tags),
    blocks,
  };
};

const ensureValidPostInput = (input: CreatePostInput): BlogPost => {
  const normalizedBlocks = input.blocks
    .map((block) => parsePostBlock(block))
    .filter((block): block is PostBlock => block !== null);

  const normalized: BlogPost = {
    slug: slugify(input.slug),
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    category: input.category,
    date: input.date.trim(),
    tags: normalizeTags(input.tags),
    blocks: normalizedBlocks,
  };

  if (!normalized.slug) {
    throw new Error("A slug is required.");
  }
  if (!normalized.title) {
    throw new Error("A title is required.");
  }
  if (!normalized.excerpt) {
    throw new Error("An excerpt is required.");
  }
  if (!isPostCategory(normalized.category)) {
    throw new Error("Category must be either 'life' or 'project'.");
  }
  if (!dateRegex.test(normalized.date)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }
  if (normalized.tags.length === 0) {
    throw new Error("At least one tag is required.");
  }
  if (normalized.blocks.length === 0) {
    throw new Error("At least one content block is required.");
  }

  return normalized;
};

export const fetchPosts = async (): Promise<BlogPost[]> => {
  if (!isFirebaseConfigured || !db) {
    return sortPostsByDate(fallbackPosts);
  }

  const snapshot = await getDocs(query(collection(db, postsCollectionName), orderBy("date", "desc")));
  const parsedPosts = snapshot.docs
    .map((item) => parsePost(item.data()))
    .filter((item): item is BlogPost => item !== null);

  return sortPostsByDate(parsedPosts);
};

export const createPost = async (input: CreatePostInput): Promise<BlogPost> => {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured yet. Add your Firebase keys to .env before publishing posts.");
  }

  const normalizedPost = ensureValidPostInput(input);
  const postRef = doc(collection(db, postsCollectionName), normalizedPost.slug);
  const existing = await getDoc(postRef);
  if (existing.exists()) {
    throw new Error("A post with this slug already exists. Choose a different slug.");
  }

  await setDoc(postRef, {
    ...normalizedPost,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return normalizedPost;
};
