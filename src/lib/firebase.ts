import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { isEditorAccessAllowed } from "./editorEnvironment";

const firebaseConfig = {
  apiKey: "AIzaSyBmTADk10HX2vVsiG0kRYLnMK_wSyklZng",
  authDomain: "gagewilletteblogs.firebaseapp.com",
  projectId: "gagewilletteblogs",
  storageBucket: "gagewilletteblogs.firebasestorage.app",
  messagingSenderId: "691942637667",
  appId: "1:691942637667:web:a1bbe8c1a0220350163856",
  measurementId: "G-Y13WYBXPQR",
};

const requiredFirebaseConfigValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
];

const hasRequiredFirebaseConfig = requiredFirebaseConfigValues.every((value) => Boolean(value));

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;

if (hasRequiredFirebaseConfig) {
  firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
  firestoreDb = getFirestore(firebaseApp);
  firebaseAuth = isEditorAccessAllowed ? getAuth(firebaseApp) : null;
}

export const isFirebaseConfigured = hasRequiredFirebaseConfig;
export const app = firebaseApp;
export const db = firestoreDb;
export const auth = firebaseAuth;