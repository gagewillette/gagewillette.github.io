import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { editorAccessDeniedMessage, isEditorAccessAllowed } from "./editorEnvironment";
import { auth } from "./firebase";
export { editorAccessDeniedMessage, isEditorAccessAllowed } from "./editorEnvironment";
export const isFirebaseAuthConfigured = Boolean(auth);
export const isFirebaseAuthEnabled = isFirebaseAuthConfigured && isEditorAccessAllowed;

export const getEditorSession = (): boolean => {
  return isEditorAccessAllowed && Boolean(auth?.currentUser);
};

export const subscribeToEditorSession = (onChange: (authed: boolean) => void): (() => void) => {
  if (!isEditorAccessAllowed || !auth) {
    onChange(false);
    return () => {};
  }

  return onAuthStateChanged(auth, (user) => onChange(Boolean(user)));
};

export const signInEditor = async (username: string, password: string): Promise<void> => {
  if (!isEditorAccessAllowed) {
    throw new Error(editorAccessDeniedMessage);
  }

  if (!auth) {
    throw new Error("Firebase Auth is not configured. Add the Firebase env vars and restart the app.");
  }

  await signInWithEmailAndPassword(auth, username.trim(), password);
};

export const signOutEditor = async (): Promise<void> => {
  if (!isEditorAccessAllowed || !auth) {
    return;
  }

  await signOut(auth);
};
