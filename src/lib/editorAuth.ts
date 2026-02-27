import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase";

export const isFirebaseAuthEnabled = Boolean(auth);

export const getEditorSession = (): boolean => {
  return Boolean(auth?.currentUser);
};

export const subscribeToEditorSession = (onChange: (authed: boolean) => void): (() => void) => {
  if (!auth) {
    onChange(false);
    return () => {};
  }

  return onAuthStateChanged(auth, (user) => onChange(Boolean(user)));
};

export const signInEditor = async (username: string, password: string): Promise<void> => {
  if (!auth) {
    throw new Error("Firebase Auth is not configured. Add the Firebase env vars and restart the app.");
  }

  await signInWithEmailAndPassword(auth, username.trim(), password);
};

export const signOutEditor = async (): Promise<void> => {
  if (!auth) {
    return;
  }

  await signOut(auth);
};
