import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { posts as fallbackPosts, type BlogPost, type PostCategory } from "../content/posts";
import { db, isFirebaseConfigured } from "./firebase";

type UnknownRecord = Record<string, unknown>;
type LegacyPostBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string; language?: string };

const postsCollectionName = "posts";
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export interface CreatePostInput {
  slug: string;
  title: string;
  excerpt: string;
  category: PostCategory;
  date: string;
  tags: string[];
  markdown: string;
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

const normalizeMarkdown = (value: string): string => {
  return value.replace(/\r\n?/g, "\n").trim();
};

const parsePostBlock = (value: unknown): LegacyPostBlock | null => {
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

const convertBlocksToMarkdown = (blocks: LegacyPostBlock[]): string => {
  return blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return block.text.trim();
      }

      if (block.type === "heading") {
        return `## ${block.text.trim()}`;
      }

      if (block.type === "quote") {
        return block.text
          .trim()
          .split("\n")
          .map((line) => `> ${line.trim()}`)
          .join("\n");
      }

      if (block.type === "list") {
        return block.items.map((item) => `- ${item.trim()}`).join("\n");
      }

      const language = block.language?.trim();
      return `\`\`\`${language ?? ""}\n${block.code.trimEnd()}\n\`\`\``;
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
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
  if (!tags) {
    return null;
  }

  const markdown = typeof value.markdown === "string" ? normalizeMarkdown(value.markdown) : "";
  const rawBlocks = Array.isArray(value.blocks) ? value.blocks : null;
  const legacyBlocks = rawBlocks?.map((block) => parsePostBlock(block)).filter((block): block is LegacyPostBlock => block !== null) ?? [];
  const normalizedMarkdown = markdown || convertBlocksToMarkdown(legacyBlocks);

  if (!normalizedMarkdown) {
    return null;
  }

  return {
    slug: slugify(value.slug),
    title: value.title.trim(),
    excerpt: value.excerpt.trim(),
    category: value.category,
    date: value.date,
    tags: normalizeTags(tags),
    markdown: normalizedMarkdown,
  };
};

const ensureValidPostInput = (input: CreatePostInput): BlogPost => {
  const normalized: BlogPost = {
    slug: slugify(input.slug),
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    category: input.category,
    date: input.date.trim(),
    tags: normalizeTags(input.tags),
    markdown: normalizeMarkdown(input.markdown),
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
  if (!normalized.markdown) {
    throw new Error("Post content cannot be empty.");
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
    contentFormat: "markdown",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return normalizedPost;
};

export const updatePost = async (originalSlug: string, input: CreatePostInput): Promise<BlogPost> => {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured yet. Add your Firebase keys to .env before editing posts.");
  }

  const normalizedOriginalSlug = slugify(originalSlug);
  if (!normalizedOriginalSlug) {
    throw new Error("The original post slug is invalid.");
  }

  const normalizedPost = ensureValidPostInput(input);
  const originalRef = doc(collection(db, postsCollectionName), normalizedOriginalSlug);
  const existing = await getDoc(originalRef);

  if (!existing.exists()) {
    throw new Error("This post no longer exists.");
  }

  const existingData = existing.data();
  const createdAt = isObject(existingData) && "createdAt" in existingData ? existingData.createdAt : serverTimestamp();

  if (normalizedOriginalSlug === normalizedPost.slug) {
    await setDoc(originalRef, {
      ...normalizedPost,
      contentFormat: "markdown",
      createdAt,
      updatedAt: serverTimestamp(),
    });

    return normalizedPost;
  }

  const nextRef = doc(collection(db, postsCollectionName), normalizedPost.slug);
  const nextExisting = await getDoc(nextRef);
  if (nextExisting.exists()) {
    throw new Error("A post with this slug already exists. Choose a different slug.");
  }

  const batch = writeBatch(db);
  batch.set(nextRef, {
    ...normalizedPost,
    contentFormat: "markdown",
    createdAt,
    updatedAt: serverTimestamp(),
  });
  batch.delete(originalRef);
  await batch.commit();

  return normalizedPost;
};
