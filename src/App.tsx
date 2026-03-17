import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { blogDescription, blogTitle, type BlogPost, type PostCategory } from "./content/posts";
import {
  createPost,
  fetchPosts,
  normalizeTags,
  slugify,
  sortPostsByDate,
  updatePost,
  type CreatePostInput,
} from "./lib/postsRepository";
import {
  editorAccessDeniedMessage,
  getEditorSession,
  isEditorAccessAllowed,
  isFirebaseAuthConfigured,
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
  | { view: "edit"; slug: string }
  | { view: "post"; slug: string }
  | { view: "not-found" };
type Theme = "light" | "dark";
type PostsStatus = "loading" | "ready" | "error";
type PostEditorMode = "create" | "edit";
type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void | Promise<void>) => {
    ready: Promise<void>;
  };
};

const themeStorageKey = "site-theme";
const firebaseSetupMessage = "Firebase Auth is not configured. Add the Firebase env vars and restart the app.";

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

  if (parts[0] === "edit" && parts[1]) {
    return { view: "edit", slug: parts[1] };
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

const getPlainTextFromMarkdown = (markdown: string): string => {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}(?:[-+*]|\d+\.)\s+/gm, "")
    .replace(/[*_~|]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n+/g, " ")
    .trim();
};

const getReadingTime = (post: BlogPost): string => {
  const text = getPlainTextFromMarkdown(post.markdown);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
};

const getDefaultDate = (): string => {
  return new Date().toISOString().slice(0, 10);
};

const toHashRoute = (path: string): string => {
  if (path.startsWith("#")) {
    return path;
  }

  if (path.startsWith("/")) {
    return `#${path}`;
  }

  return `#/${path}`;
};

const goToRoute = (path: string): void => {
  window.location.hash = toHashRoute(path);
};

const getPostRoute = (slug: string): string => `/post/${slug}`;
const getEditRoute = (slug: string): string => `/edit/${slug}`;

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
  const [isSavingPost, setIsSavingPost] = useState(false);

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

  const activePostSlug = route.view === "post" || route.view === "edit" ? route.slug : undefined;
  const activePost = useMemo(() => {
    if (!activePostSlug) {
      return undefined;
    }

    return sortedPosts.find((post) => post.slug === activePostSlug);
  }, [activePostSlug, sortedPosts]);

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
              : route.view === "edit" && activePost
                ? `Edit ${activePost.title} | ${blogTitle}`
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

  const syncSavedPost = useCallback((savedPost: BlogPost, previousSlug?: string) => {
    setPosts((currentPosts) =>
      sortPostsByDate(
        [savedPost, ...currentPosts].filter((post, index, items) => {
          const isDuplicateSavedPost = post.slug === savedPost.slug && items.findIndex((item) => item.slug === post.slug) !== index;
          const isOldSlug = previousSlug !== undefined && previousSlug !== savedPost.slug && post.slug === previousSlug;
          return !isDuplicateSavedPost && !isOldSlug;
        }),
      ),
    );
  }, []);

  const handleEditorLogin = async (username: string, password: string): Promise<void> => {
    await signInEditor(username, password);
    setIsEditorAuthed(true);
  };

  const handleEditorLogout = async (): Promise<void> => {
    await signOutEditor();
    setIsEditorAuthed(false);
  };

  const handleCreatePost = async (input: CreatePostInput): Promise<BlogPost> => {
    setIsSavingPost(true);

    try {
      const createdPost = await createPost(input);
      syncSavedPost(createdPost);
      return createdPost;
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleUpdatePost = async (originalSlug: string, input: CreatePostInput): Promise<BlogPost> => {
    setIsSavingPost(true);

    try {
      const savedPost = await updatePost(originalSlug, input);
      syncSavedPost(savedPost, originalSlug);
      return savedPost;
    } finally {
      setIsSavingPost(false);
    }
  };

  const canManagePosts = isEditorAccessAllowed && isEditorAuthed;
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
        <SiteHeader showEditorLink={isEditorAccessAllowed} />

        <main className="main-content">
          {route.view === "home" && (
            <HomePage posts={sortedPosts} postsStatus={postsStatus} postsError={postsError} canEditPosts={canManagePosts} />
          )}
          {route.view === "posts" && (
            <PostsPage posts={sortedPosts} postsStatus={postsStatus} postsError={postsError} canEditPosts={canManagePosts} />
          )}
          {route.view === "about" && <AboutPage />}
          {route.view === "new" && (
            <NewPostPage
              isEditorAccessAllowed={isEditorAccessAllowed}
              isAuthConfigured={isFirebaseAuthConfigured}
              isAuthReady={isEditorSessionReady}
              isAuthed={isEditorAuthed}
              onLogin={handleEditorLogin}
              onLogout={handleEditorLogout}
              onCreatePost={handleCreatePost}
              isSaving={isSavingPost}
            />
          )}
          {route.view === "post" && postsStatus === "loading" && <LoadingState label="Loading post..." />}
          {route.view === "post" && postsStatus === "error" && <ErrorState message={postsError || "Could not load this post."} />}
          {route.view === "post" && postsStatus === "ready" && activePost && <PostPage post={activePost} canEdit={canManagePosts} />}
          {route.view === "edit" && (
            <EditPostPage
              post={activePost}
              postsStatus={postsStatus}
              postsError={postsError}
              isEditorAccessAllowed={isEditorAccessAllowed}
              isAuthConfigured={isFirebaseAuthConfigured}
              isAuthReady={isEditorSessionReady}
              isAuthed={isEditorAuthed}
              onLogin={handleEditorLogin}
              onLogout={handleEditorLogout}
              onUpdatePost={handleUpdatePost}
              isSaving={isSavingPost}
            />
          )}
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

const SiteHeader = ({ showEditorLink }: { showEditorLink: boolean }) => {
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
        {showEditorLink && (
          <a href="#/new" className="nav-link">
            New
          </a>
        )}
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

const EditorAccessState = ({ title, message }: { title: string; message: string }) => {
  return (
    <section className="section-block fade-in">
      <article className="new-post-shell">
        <h1 className="page-title">{title}</h1>
        <p className="page-intro">{message}</p>
      </article>
    </section>
  );
};

const HomePage = ({
  posts,
  postsStatus,
  postsError,
  canEditPosts,
}: {
  posts: BlogPost[];
  postsStatus: PostsStatus;
  postsError: string | null;
  canEditPosts: boolean;
}) => {
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
                  <PostCard key={post.slug} post={post} canEdit={canEditPosts} />
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
                    <span className="project-log-link-group">
                      <a href={toHashRoute(getPostRoute(post.slug))}>{post.title}</a>
                      {canEditPosts && (
                        <a href={toHashRoute(getEditRoute(post.slug))} className="text-link">
                          Edit
                        </a>
                      )}
                    </span>
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

const PostsPage = ({
  posts,
  postsStatus,
  postsError,
  canEditPosts,
}: {
  posts: BlogPost[];
  postsStatus: PostsStatus;
  postsError: string | null;
  canEditPosts: boolean;
}) => {
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
              <PostCard key={post.slug} post={post} canEdit={canEditPosts} />
            ))}
          </div>
        ))}
    </section>
  );
};

const PostCard = ({ post, canEdit }: { post: BlogPost; canEdit: boolean }) => {
  return (
    <article className="post-card">
      <p className="meta-line">
        {formatDate(post.date)} | {getReadingTime(post)}
      </p>
      <h3>
        <a href={toHashRoute(getPostRoute(post.slug))}>{post.title}</a>
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
      {canEdit && (
        <div className="post-management-row">
          <a href={toHashRoute(getEditRoute(post.slug))} className="text-link">
            Edit post
          </a>
        </div>
      )}
    </article>
  );
};

const PostPage = ({ post, canEdit }: { post: BlogPost; canEdit: boolean }) => {
  return (
    <article className="post-page fade-in">
      <div className="post-page-top">
        <a href="#/posts" className="text-link">
          Back to posts
        </a>
        {canEdit && (
          <a href={toHashRoute(getEditRoute(post.slug))} className="text-link">
            Edit this post
          </a>
        )}
      </div>
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
      <MarkdownContent markdown={post.markdown} className="post-content" />
    </article>
  );
};

const MarkdownContent = ({ markdown, className }: { markdown: string; className?: string }) => {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
};

const EditorLoginPage = ({
  title,
  intro,
  onLogin,
}: {
  title: string;
  intro: string;
  onLogin: (username: string, password: string) => Promise<void>;
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

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

  return (
    <section className="section-block fade-in">
      <article className="new-post-shell">
        <h1 className="page-title">{title}</h1>
        <p className="page-intro">{intro}</p>

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
};

const PostEditorForm = ({
  mode,
  initialPost,
  onLogout,
  onSubmit,
  isSubmitting,
}: {
  mode: PostEditorMode;
  initialPost?: BlogPost;
  onLogout: () => Promise<void>;
  onSubmit: (input: CreatePostInput) => Promise<BlogPost>;
  isSubmitting: boolean;
}) => {
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [slug, setSlug] = useState(initialPost?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [category, setCategory] = useState<PostCategory>(initialPost?.category ?? "project");
  const [date, setDate] = useState(initialPost?.date ?? getDefaultDate());
  const [tagsInput, setTagsInput] = useState(initialPost?.tags.join(", ") ?? "");
  const [markdown, setMarkdown] = useState(initialPost?.markdown ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditMode = mode === "edit";

  useEffect(() => {
    setTitle(initialPost?.title ?? "");
    setSlug(initialPost?.slug ?? "");
    setExcerpt(initialPost?.excerpt ?? "");
    setCategory(initialPost?.category ?? "project");
    setDate(initialPost?.date ?? getDefaultDate());
    setTagsInput(initialPost?.tags.join(", ") ?? "");
    setMarkdown(initialPost?.markdown ?? "");
    setSubmitError(null);
  }, [initialPost, mode]);

  const handleGenerateSlug = (): void => {
    setSlug(slugify(title));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitError(null);

    try {
      const postInput: CreatePostInput = {
        slug: slugify(slug || title),
        title,
        excerpt,
        category,
        date,
        tags: normalizeTags(tagsInput.split(",")),
        markdown,
      };

      const savedPost = await onSubmit(postInput);
      goToRoute(getPostRoute(savedPost.slug));
    } catch (error) {
      const message = error instanceof Error ? error.message : `Could not ${isEditMode ? "save" : "publish"} post.`;
      setSubmitError(message);
    }
  };

  return (
    <section className="section-block fade-in">
      <article className="new-post-shell">
        <div className="new-post-head">
          <div>
            <h1 className="page-title">{isEditMode ? "Edit Post" : "Create New Post"}</h1>
            <p className="page-intro">
              {isEditMode
                ? "Update title, metadata, and Markdown content using the live preview below."
                : "Write posts in Markdown and publish them directly to Firestore."}
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={() => void onLogout()}>
            Log out
          </button>
        </div>

        <form className="new-post-form" onSubmit={handleSubmit}>
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
              <h2>Markdown</h2>
              <p className="editor-hint">Supports headings, lists, links, images, code fences, tables, and blockquotes.</p>
            </div>
            <label className="field-label" htmlFor="post-markdown">
              Body
            </label>
            <textarea
              id="post-markdown"
              className="field-textarea markdown-editor"
              rows={18}
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              placeholder={"## Shipping notes\n\nWrite in Markdown here.\n\n- Lists\n- Images\n- Links\n\n```ts\nconsole.log(\"hello\");\n```"}
              required
            />
          </div>

          <div className="field-group">
            <div className="section-headline-row">
              <h2>Preview</h2>
              <p className="editor-hint">Rendered using the same typography and post styles as the live site.</p>
            </div>
            <div className="markdown-preview">
              {markdown.trim() ? (
                <MarkdownContent markdown={markdown} className="post-content" />
              ) : (
                <p className="empty-markdown-preview">Start writing to preview the rendered post.</p>
              )}
            </div>
          </div>

          {submitError && <p className="form-feedback error">{submitError}</p>}

          <button type="submit" className="action-button" disabled={isSubmitting}>
            {isSubmitting ? (isEditMode ? "Saving..." : "Publishing...") : isEditMode ? "Save Changes" : "Publish Post"}
          </button>
        </form>
      </article>
    </section>
  );
};

const NewPostPage = ({
  isEditorAccessAllowed: canAccessEditor,
  isAuthConfigured,
  isAuthReady,
  isAuthed,
  onLogin,
  onLogout,
  onCreatePost,
  isSaving,
}: {
  isEditorAccessAllowed: boolean;
  isAuthConfigured: boolean;
  isAuthReady: boolean;
  isAuthed: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onCreatePost: (input: CreatePostInput) => Promise<BlogPost>;
  isSaving: boolean;
}) => {
  if (!canAccessEditor) {
    return <EditorAccessState title="Editor Unavailable" message={editorAccessDeniedMessage} />;
  }

  if (!isAuthConfigured) {
    return <EditorAccessState title="Firebase Setup Needed" message={firebaseSetupMessage} />;
  }

  if (!isAuthReady) {
    return <LoadingState label="Checking editor session..." />;
  }

  if (!isAuthed) {
    return (
      <EditorLoginPage
        title="Editor Login"
        intro="Sign in with your Firebase email/password to access the local `/new` route."
        onLogin={onLogin}
      />
    );
  }

  return <PostEditorForm mode="create" onLogout={onLogout} onSubmit={onCreatePost} isSubmitting={isSaving} />;
};

const EditPostPage = ({
  post,
  postsStatus,
  postsError,
  isEditorAccessAllowed: canAccessEditor,
  isAuthConfigured,
  isAuthReady,
  isAuthed,
  onLogin,
  onLogout,
  onUpdatePost,
  isSaving,
}: {
  post?: BlogPost;
  postsStatus: PostsStatus;
  postsError: string | null;
  isEditorAccessAllowed: boolean;
  isAuthConfigured: boolean;
  isAuthReady: boolean;
  isAuthed: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onUpdatePost: (originalSlug: string, input: CreatePostInput) => Promise<BlogPost>;
  isSaving: boolean;
}) => {
  if (!canAccessEditor) {
    return <EditorAccessState title="Editor Unavailable" message={editorAccessDeniedMessage} />;
  }

  if (!isAuthConfigured) {
    return <EditorAccessState title="Firebase Setup Needed" message={firebaseSetupMessage} />;
  }

  if (postsStatus === "loading") {
    return <LoadingState label="Loading post..." />;
  }

  if (postsStatus === "error") {
    return <ErrorState message={postsError || "Could not load this post."} />;
  }

  if (!post) {
    return <NotFoundPage />;
  }

  if (!isAuthReady) {
    return <LoadingState label="Checking editor session..." />;
  }

  if (!isAuthed) {
    return (
      <EditorLoginPage
        title="Editor Login"
        intro="Sign in with your Firebase email/password to edit this post from the local dev server."
        onLogin={onLogin}
      />
    );
  }

  return (
    <PostEditorForm
      mode="edit"
      initialPost={post}
      onLogout={onLogout}
      onSubmit={(input) => onUpdatePost(post.slug, input)}
      isSubmitting={isSaving}
    />
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
