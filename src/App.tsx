import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { blogDescription, blogTitle, type BlogPost, type PostBlock, type PostCategory } from "./content/posts";
import {
  createPost,
  fetchPosts,
  normalizeTags,
  slugify,
  sortPostsByDate,
  type CreatePostInput,
} from "./lib/postsRepository";
import {
  getEditorSession,
  isFirebaseAuthEnabled,
  signInEditor,
  signOutEditor,
  subscribeToEditorSession,
} from "./lib/editorAuth";

type Route =
  | { view: "home" }
  | { view: "posts" }
  | { view: "about" }
  | { view: "new" }
  | { view: "post"; slug: string }
  | { view: "not-found" };
type Theme = "light" | "dark";
type PostsStatus = "loading" | "ready" | "error";
type BlockKind = PostBlock["type"];
type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void | Promise<void>) => {
    ready: Promise<void>;
  };
};

type BlockDraft =
  | { id: string; type: "paragraph" | "heading" | "quote"; text: string }
  | { id: string; type: "list"; itemsText: string }
  | { id: string; type: "code"; code: string; language: string };

const themeStorageKey = "site-theme";

const getInitialTheme = (): Theme => {
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const syncThemeToDom = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
};

const parseRoute = (rawRoute: string): Route => {
  const normalized = rawRoute.replace(/^#/, "") || "/";
  const parts = normalized
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);

  if (parts.length === 0) {
    return { view: "home" };
  }

  if (parts[0] === "posts" && parts.length === 1) {
    return { view: "posts" };
  }

  if (parts[0] === "about" && parts.length === 1) {
    return { view: "about" };
  }

  if (parts[0] === "new" && parts.length === 1) {
    return { view: "new" };
  }

  if (parts[0] === "post" && parts[1]) {
    return { view: "post", slug: parts[1] };
  }

  return { view: "not-found" };
};

const getRouteFromLocation = (): Route => {
  const hashRoute = window.location.hash;
  if (hashRoute) {
    return parseRoute(hashRoute);
  }

  return parseRoute(window.location.pathname);
};

const formatDate = (date: string): string => {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getReadingTime = (post: BlogPost): string => {
  const text = post.blocks
    .map((block) => {
      if (block.type === "list") {
        return block.items.join(" ");
      }
      if (block.type === "code") {
        return "";
      }
      return block.text;
    })
    .join(" ");

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
};

const createBlockId = (): string => {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildBlockDraft = (type: BlockKind): BlockDraft => {
  if (type === "list") {
    return { id: createBlockId(), type: "list", itemsText: "" };
  }

  if (type === "code") {
    return { id: createBlockId(), type: "code", code: "", language: "" };
  }

  return { id: createBlockId(), type, text: "" };
};

const getDefaultDate = (): string => {
  return new Date().toISOString().slice(0, 10);
};

const buildPostBlocksFromDraft = (blocks: BlockDraft[]): PostBlock[] => {
  const parsedBlocks: PostBlock[] = [];

  blocks.forEach((block) => {
    if (block.type === "list") {
      const items = block.itemsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      if (items.length > 0) {
        parsedBlocks.push({ type: "list", items });
      }
      return;
    }

    if (block.type === "code") {
      const code = block.code.trimEnd();
      if (code) {
        parsedBlocks.push({
          type: "code",
          code,
          language: block.language.trim() || undefined,
        });
      }
      return;
    }

    const text = block.text.trim();
    if (text) {
      parsedBlocks.push({ type: block.type, text });
    }
  });

  if (parsedBlocks.length === 0) {
    throw new Error("Add at least one content block with text or code.");
  }

  return parsedBlocks;
};

function App() {
  const [route, setRoute] = useState<Route>(getRouteFromLocation);
  const [theme, setTheme] = useState<Theme>(() => {
    const initialTheme = getInitialTheme();
    syncThemeToDom(initialTheme);
    return initialTheme;
  });
  const [isThemeSwitching, setIsThemeSwitching] = useState(false);
  const themeToggleRef = useRef<HTMLButtonElement>(null);
  const themeSwitchTimerRef = useRef<number | null>(null);

  const [postsStatus, setPostsStatus] = useState<PostsStatus>("loading");
  const [postsError, setPostsError] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  const [isEditorAuthed, setIsEditorAuthed] = useState<boolean>(getEditorSession);
  const [isEditorSessionReady, setIsEditorSessionReady] = useState(!isFirebaseAuthEnabled);

  useEffect(() => {
    const syncRoute = (): void => setRoute(getRouteFromLocation());

    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);

    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToEditorSession((authed) => {
      setIsEditorAuthed(authed);
      setIsEditorSessionReady(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadPosts = useCallback(async () => {
    setPostsStatus("loading");
    setPostsError(null);

    try {
      const loadedPosts = await fetchPosts();
      setPosts(sortPostsByDate(loadedPosts));
      setPostsStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load posts.";
      setPostsError(message);
      setPostsStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const sortedPosts = useMemo(() => sortPostsByDate(posts), [posts]);

  const activePost = useMemo(() => {
    if (route.view !== "post") {
      return undefined;
    }

    return sortedPosts.find((post) => post.slug === route.slug);
  }, [route, sortedPosts]);

  useEffect(() => {
    const routeTitle =
      route.view === "home"
        ? blogTitle
        : route.view === "posts"
          ? `Posts | ${blogTitle}`
          : route.view === "about"
            ? `About | ${blogTitle}`
            : route.view === "new"
              ? `New Post | ${blogTitle}`
              : route.view === "post" && activePost
                ? `${activePost.title} | ${blogTitle}`
                : `Not Found | ${blogTitle}`;

    document.title = routeTitle;
  }, [route, activePost]);

  useEffect(() => {
    syncThemeToDom(theme);
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (themeSwitchTimerRef.current !== null) {
        window.clearTimeout(themeSwitchTimerRef.current);
      }
    };
  }, []);

  const handleThemeToggle = () => {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    const toggleBounds = themeToggleRef.current?.getBoundingClientRect();
    const centerX = toggleBounds ? toggleBounds.left + toggleBounds.width / 2 : 28;
    const centerY = toggleBounds ? toggleBounds.top + toggleBounds.height / 2 : 28;

    setIsThemeSwitching(true);
    if (themeSwitchTimerRef.current !== null) {
      window.clearTimeout(themeSwitchTimerRef.current);
    }
    themeSwitchTimerRef.current = window.setTimeout(() => setIsThemeSwitching(false), 760);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const docWithTransition = document as DocumentWithViewTransition;

    if (reduceMotion || !docWithTransition.startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    try {
      const transition = docWithTransition.startViewTransition(() => {
        flushSync(() => {
          setTheme(nextTheme);
        });
      });

      transition.ready
        .then(() => {
          const endRadius = Math.hypot(
            Math.max(centerX, window.innerWidth - centerX),
            Math.max(centerY, window.innerHeight - centerY),
          );

          document.documentElement.animate(
            {
              clipPath: [`circle(0px at ${centerX}px ${centerY}px)`, `circle(${endRadius}px at ${centerX}px ${centerY}px)`],
            },
            {
              duration: 760,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        })
        .catch(() => {});
    } catch {
      setTheme(nextTheme);
    }
  };

  const handleEditorLogin = async (username: string, password: string): Promise<void> => {
    await signInEditor(username, password);
    setIsEditorAuthed(true);
  };

  const handleEditorLogout = async (): Promise<void> => {
    await signOutEditor();
    setIsEditorAuthed(false);
  };

  const handleCreatePost = async (input: CreatePostInput): Promise<BlogPost> => {
    setIsCreatingPost(true);
    try {
      const createdPost = await createPost(input);
      setPosts((currentPosts) => sortPostsByDate([createdPost, ...currentPosts.filter((post) => post.slug !== createdPost.slug)]));
      return createdPost;
    } finally {
      setIsCreatingPost(false);
    }
  };

  const shouldShowMissingPost = route.view === "post" && !activePost && postsStatus !== "loading";

  return (
    <div className="site-shell">
      <button
        ref={themeToggleRef}
        type="button"
        className={isThemeSwitching ? "theme-toggle is-switching" : "theme-toggle"}
        onClick={handleThemeToggle}
        aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        aria-pressed={theme === "dark"}
      >
        <span className="theme-toggle-icon" aria-hidden="true">
          <span className="icon-sun" />
          <span className="icon-moon" />
        </span>
      </button>

      <BackgroundAccent />

      <div className="site-content">
        <SiteHeader />

        <main className="main-content">
          {route.view === "home" && <HomePage posts={sortedPosts} postsStatus={postsStatus} postsError={postsError} />}
          {route.view === "posts" && <PostsPage posts={sortedPosts} postsStatus={postsStatus} postsError={postsError} />}
          {route.view === "about" && <AboutPage />}
          {route.view === "new" && (
            <NewPostPage
              isAuthReady={isEditorSessionReady}
              isAuthed={isEditorAuthed}
              onLogin={handleEditorLogin}
              onLogout={handleEditorLogout}
              onCreatePost={handleCreatePost}
              isCreating={isCreatingPost}
            />
          )}
          {route.view === "post" && postsStatus === "loading" && <LoadingState label="Loading post..." />}
          {route.view === "post" && postsStatus === "error" && <ErrorState message={postsError || "Could not load this post."} />}
          {route.view === "post" && postsStatus === "ready" && activePost && <PostPage post={activePost} />}
          {(route.view === "not-found" || shouldShowMissingPost) && <NotFoundPage />}
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}

const BackgroundAccent = () => {
  return (
    <div className="background-accent" aria-hidden="true">
      <span className="accent accent-one" />
      <span className="accent accent-two" />
    </div>
  );
};

const SiteHeader = () => {
  return (
    <header className="site-header fade-in">
      <a href="#/" className="site-title">
        {blogTitle}
      </a>
      <nav className="site-nav" aria-label="Main navigation">
        <a href="#/" className="nav-link">
          Home
        </a>
        <a href="#/posts" className="nav-link">
          Posts
        </a>
        <a href="#/about" className="nav-link">
          About
        </a>
        <a href="#/new" className="nav-link">
          New
        </a>
      </nav>
    </header>
  );
};

const LoadingState = ({ label }: { label: string }) => {
  return (
    <section className="section-block fade-in">
      <div className="notice-panel" role="status" aria-live="polite">
        {label}
      </div>
    </section>
  );
};

const ErrorState = ({ message }: { message: string }) => {
  return (
    <section className="section-block fade-in">
      <div className="notice-panel error" role="alert">
        {message}
      </div>
    </section>
  );
};

const EmptyState = ({ message }: { message: string }) => {
  return <p className="page-intro">{message}</p>;
};

const HomePage = ({ posts, postsStatus, postsError }: { posts: BlogPost[]; postsStatus: PostsStatus; postsError: string | null }) => {
  const latestPosts = posts.slice(0, 3);
  const projectPosts = posts.filter((post) => post.category === "project").slice(0, 3);

  return (
    <>
      <section className="hero fade-in">
        <p className="eyebrow">Developer Blog</p>
        <h1>Notes on code, work-in-progress projects, and day-to-day life.</h1>
        <p>{blogDescription}</p>
      </section>

      {postsStatus === "loading" && <LoadingState label="Loading posts..." />}
      {postsStatus === "error" && <ErrorState message={postsError || "Could not load posts."} />}

      {postsStatus === "ready" && (
        <>
          <section className="section-block stagger-children">
            <div className="section-headline-row">
              <h2>Latest Posts</h2>
              <a href="#/posts" className="text-link">
                View all posts
              </a>
            </div>
            {latestPosts.length === 0 ? (
              <EmptyState message="No posts yet." />
            ) : (
              <div className="post-grid">
                {latestPosts.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            )}
          </section>

          <section className="section-block stagger-children">
            <div className="section-headline-row">
              <h2>Project Log</h2>
              <a href="#/posts" className="text-link">
                More project notes
              </a>
            </div>
            {projectPosts.length === 0 ? (
              <EmptyState message="No project log posts yet." />
            ) : (
              <ul className="project-log">
                {projectPosts.map((post) => (
                  <li key={post.slug}>
                    <a href={`#/post/${post.slug}`}>{post.title}</a>
                    <span>{formatDate(post.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
};

const PostsPage = ({ posts, postsStatus, postsError }: { posts: BlogPost[]; postsStatus: PostsStatus; postsError: string | null }) => {
  const [filter, setFilter] = useState<PostCategory | "all">("all");

  const filteredPosts = useMemo(() => {
    if (filter === "all") {
      return posts;
    }

    return posts.filter((post) => post.category === filter);
  }, [filter, posts]);

  return (
    <section className="section-block fade-in">
      <h1 className="page-title">All Posts</h1>
      <p className="page-intro">Browse life updates and technical write-ups in chronological order.</p>

      <div className="filter-row" role="group" aria-label="Filter posts">
        <button
          type="button"
          className={filter === "all" ? "filter-chip active" : "filter-chip"}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={filter === "project" ? "filter-chip active" : "filter-chip"}
          onClick={() => setFilter("project")}
        >
          Projects
        </button>
        <button
          type="button"
          className={filter === "life" ? "filter-chip active" : "filter-chip"}
          onClick={() => setFilter("life")}
        >
          Life
        </button>
      </div>

      {postsStatus === "loading" && <LoadingState label="Loading posts..." />}
      {postsStatus === "error" && <ErrorState message={postsError || "Could not load posts."} />}

      {postsStatus === "ready" &&
        (filteredPosts.length === 0 ? (
          <EmptyState message="No posts available for this filter." />
        ) : (
          <div className="post-list stagger-children">
            {filteredPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        ))}
    </section>
  );
};

const PostCard = ({ post }: { post: BlogPost }) => {
  return (
    <article className="post-card">
      <p className="meta-line">
        {formatDate(post.date)} | {getReadingTime(post)}
      </p>
      <h3>
        <a href={`#/post/${post.slug}`}>{post.title}</a>
      </h3>
      <p>{post.excerpt}</p>
      <div className="tag-row">
        <span className="category-pill">{post.category}</span>
        {post.tags.map((tag) => (
          <span key={tag} className="tag-pill">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
};

const PostPage = ({ post }: { post: BlogPost }) => {
  return (
    <article className="post-page fade-in">
      <a href="#/posts" className="text-link">
        Back to posts
      </a>
      <h1>{post.title}</h1>
      <p className="meta-line">
        {formatDate(post.date)} | {getReadingTime(post)}
      </p>
      <div className="tag-row">
        <span className="category-pill">{post.category}</span>
        {post.tags.map((tag) => (
          <span key={tag} className="tag-pill">
            {tag}
          </span>
        ))}
      </div>
      <div className="post-content">{post.blocks.map((block, index) => renderBlock(block, index))}</div>
    </article>
  );
};

const renderBlock = (block: PostBlock, index: number) => {
  const key = `${block.type}-${index}`;

  if (block.type === "paragraph") {
    return <p key={key}>{block.text}</p>;
  }

  if (block.type === "heading") {
    return <h2 key={key}>{block.text}</h2>;
  }

  if (block.type === "quote") {
    return <blockquote key={key}>{block.text}</blockquote>;
  }

  if (block.type === "code") {
    return (
      <pre key={key}>
        <code>{block.code}</code>
      </pre>
    );
  }

  return (
    <ul key={key}>
      {block.items.map((item, itemIndex) => (
        <li key={`${key}-${itemIndex}`}>{item}</li>
      ))}
    </ul>
  );
};

const NewPostPage = ({
  isAuthReady,
  isAuthed,
  onLogin,
  onLogout,
  onCreatePost,
  isCreating,
}: {
  isAuthReady: boolean;
  isAuthed: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onCreatePost: (input: CreatePostInput) => Promise<BlogPost>;
  isCreating: boolean;
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState<PostCategory>("project");
  const [date, setDate] = useState(getDefaultDate);
  const [tagsInput, setTagsInput] = useState("");
  const [blocks, setBlocks] = useState<BlockDraft[]>([buildBlockDraft("paragraph")]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const handleLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      await onLogin(username, password);
      setPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed.";
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAddBlock = (type: BlockKind): void => {
    setBlocks((currentBlocks) => [...currentBlocks, buildBlockDraft(type)]);
  };

  const handleMoveBlock = (index: number, direction: "up" | "down"): void => {
    setBlocks((currentBlocks) => {
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= currentBlocks.length) {
        return currentBlocks;
      }

      const updatedBlocks = [...currentBlocks];
      const [moved] = updatedBlocks.splice(index, 1);
      updatedBlocks.splice(nextIndex, 0, moved);
      return updatedBlocks;
    });
  };

  const handleRemoveBlock = (index: number): void => {
    setBlocks((currentBlocks) => {
      if (currentBlocks.length === 1) {
        return [buildBlockDraft("paragraph")];
      }

      return currentBlocks.filter((_, blockIndex) => blockIndex !== index);
    });
  };

  const handleBlockTypeChange = (index: number, nextType: BlockKind): void => {
    setBlocks((currentBlocks) => currentBlocks.map((block, blockIndex) => (blockIndex === index ? buildBlockDraft(nextType) : block)));
  };

  const handleBlockTextChange = (index: number, value: string): void => {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block, blockIndex) => {
        if (blockIndex !== index) {
          return block;
        }

        if (block.type === "list") {
          return { ...block, itemsText: value };
        }

        if (block.type === "code") {
          return { ...block, code: value };
        }

        return { ...block, text: value };
      }),
    );
  };

  const handleBlockLanguageChange = (index: number, value: string): void => {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block, blockIndex) => {
        if (blockIndex !== index || block.type !== "code") {
          return block;
        }

        return { ...block, language: value };
      }),
    );
  };

  const handleGenerateSlug = (): void => {
    setSlug(slugify(title));
  };

  const handlePublishPost = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const parsedBlocks = buildPostBlocksFromDraft(blocks);
      const postInput: CreatePostInput = {
        slug: slugify(slug || title),
        title,
        excerpt,
        category,
        date,
        tags: normalizeTags(tagsInput.split(",")),
        blocks: parsedBlocks,
      };

      const createdPost = await onCreatePost(postInput);
      setSubmitSuccess(`Published \"${createdPost.title}\" successfully.`);
      setTitle("");
      setSlug("");
      setExcerpt("");
      setTagsInput("");
      setDate(getDefaultDate());
      setBlocks([buildBlockDraft("paragraph")]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish post.";
      setSubmitError(message);
    }
  };

  if (!isAuthReady) {
    return <LoadingState label="Checking editor session..." />;
  }

  if (!isAuthed) {
    return (
      <section className="section-block fade-in">
        <article className="new-post-shell">
          <h1 className="page-title">Editor Login</h1>
          <p className="page-intro">Sign in with your Firebase email/password to access the `/new` route.</p>

          <form className="editor-login-form" onSubmit={handleLogin}>
            <label className="field-label" htmlFor="editor-username">
              Username / Email
            </label>
            <input
              id="editor-username"
              className="field-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />

            <label className="field-label" htmlFor="editor-password">
              Password
            </label>
            <input
              id="editor-password"
              className="field-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />

            {loginError && <p className="form-feedback error">{loginError}</p>}

            <button type="submit" className="action-button" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </article>
      </section>
    );
  }

  return (
    <section className="section-block fade-in">
      <article className="new-post-shell">
        <div className="new-post-head">
          <h1 className="page-title">Create New Post</h1>
          <button type="button" className="secondary-button" onClick={() => void onLogout()}>
            Log out
          </button>
        </div>

        <p className="page-intro">Create blog posts that feed both the posts list and project log automatically.</p>

        <form className="new-post-form" onSubmit={handlePublishPost}>
          <div className="field-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="post-title">
                Title
              </label>
              <input
                id="post-title"
                className="field-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="post-slug">
                Slug
              </label>
              <div className="inline-input-row">
                <input
                  id="post-slug"
                  className="field-input"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="auto-generated-if-empty"
                />
                <button type="button" className="secondary-button" onClick={handleGenerateSlug}>
                  Generate
                </button>
              </div>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="post-excerpt">
              Excerpt
            </label>
            <textarea
              id="post-excerpt"
              className="field-textarea"
              rows={3}
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              required
            />
          </div>

          <div className="field-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="post-category">
                Category
              </label>
              <select
                id="post-category"
                className="field-input"
                value={category}
                onChange={(event) => setCategory(event.target.value as PostCategory)}
              >
                <option value="project">Project</option>
                <option value="life">Life</option>
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="post-date">
                Date
              </label>
              <input
                id="post-date"
                className="field-input"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="post-tags">
              Tags (comma-separated)
            </label>
            <input
              id="post-tags"
              className="field-input"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="react, firebase, shipping"
              required
            />
          </div>

          <div className="field-group">
            <div className="section-headline-row">
              <h2>Content Blocks</h2>
              <div className="block-add-row">
                <button type="button" className="secondary-button" onClick={() => handleAddBlock("paragraph")}>
                  + Paragraph
                </button>
                <button type="button" className="secondary-button" onClick={() => handleAddBlock("heading")}>
                  + Heading
                </button>
                <button type="button" className="secondary-button" onClick={() => handleAddBlock("list")}>
                  + List
                </button>
                <button type="button" className="secondary-button" onClick={() => handleAddBlock("quote")}>
                  + Quote
                </button>
                <button type="button" className="secondary-button" onClick={() => handleAddBlock("code")}>
                  + Code
                </button>
              </div>
            </div>

            <div className="block-editor-list">
              {blocks.map((block, index) => (
                <article className="block-editor-card" key={block.id}>
                  <div className="block-editor-top">
                    <strong>Block {index + 1}</strong>
                    <div className="block-controls">
                      <button type="button" className="tiny-button" onClick={() => handleMoveBlock(index, "up")}>
                        Up
                      </button>
                      <button type="button" className="tiny-button" onClick={() => handleMoveBlock(index, "down")}>
                        Down
                      </button>
                      <button type="button" className="tiny-button danger" onClick={() => handleRemoveBlock(index)}>
                        Remove
                      </button>
                    </div>
                  </div>

                  <label className="field-label">Type</label>
                  <select
                    className="field-input"
                    value={block.type}
                    onChange={(event) => handleBlockTypeChange(index, event.target.value as BlockKind)}
                  >
                    <option value="paragraph">Paragraph</option>
                    <option value="heading">Heading</option>
                    <option value="list">List</option>
                    <option value="quote">Quote</option>
                    <option value="code">Code</option>
                  </select>

                  {block.type === "code" && (
                    <>
                      <label className="field-label">Language (optional)</label>
                      <input
                        className="field-input"
                        value={block.language}
                        onChange={(event) => handleBlockLanguageChange(index, event.target.value)}
                        placeholder="typescript"
                      />
                    </>
                  )}

                  <label className="field-label">{block.type === "list" ? "List items (one per line)" : "Content"}</label>
                  <textarea
                    className="field-textarea"
                    rows={block.type === "code" ? 8 : 5}
                    value={
                      block.type === "list"
                        ? block.itemsText
                        : block.type === "code"
                          ? block.code
                          : block.text
                    }
                    onChange={(event) => handleBlockTextChange(index, event.target.value)}
                  />
                </article>
              ))}
            </div>
          </div>

          {submitError && <p className="form-feedback error">{submitError}</p>}
          {submitSuccess && <p className="form-feedback success">{submitSuccess}</p>}

          <button type="submit" className="action-button" disabled={isCreating}>
            {isCreating ? "Publishing..." : "Publish Post"}
          </button>
        </form>
      </article>
    </section>
  );
};

const AboutPage = () => {
  return (
    <section className="section-block fade-in">
      <h1 className="page-title">About This Blog</h1>
      <div className="about-text">
        <p>
          I use this site as a running log for what I am building and what I am learning. Some posts are technical,
          some are personal process notes.
        </p>
        <p>
          The goal is to publish frequently, stay honest about progress, and keep each entry useful for future me and
          for anyone following along.
        </p>
        <p>
          For project updates, check the Posts page and filter by <strong>Projects</strong>. For day-to-day updates,
          filter by <strong>Life</strong>.
        </p>
      </div>
    </section>
  );
};

const NotFoundPage = () => {
  return (
    <section className="section-block fade-in">
      <h1 className="page-title">Page not found</h1>
      <p className="page-intro">That route does not exist in this blog.</p>
      <a href="#/" className="text-link">
        Go back home
      </a>
    </section>
  );
};

const SiteFooter = () => {
  return (
    <footer className="site-footer fade-in">
      <p>
        (c) {new Date().getFullYear()} {blogTitle}.
      </p>
    </footer>
  );
};

export default App;
