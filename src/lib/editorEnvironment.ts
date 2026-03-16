const localhostHostnames = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const isLocalEditorHost = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return localhostHostnames.has(window.location.hostname);
};

export const editorAccessDeniedMessage =
  "Editor access is only available from the local Vite dev server on localhost.";

export const isEditorAccessAllowed = import.meta.env.DEV && isLocalEditorHost();
