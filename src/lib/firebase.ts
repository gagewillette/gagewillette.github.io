import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasRequiredFirebaseConfig = Object.values(firebaseConfig).every((value) => Boolean(value));

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;

if (hasRequiredFirebaseConfig) {
  firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
  firestoreDb = getFirestore(firebaseApp);
  firebaseAuth = getAuth(firebaseApp);
}

export const isFirebaseConfigured = hasRequiredFirebaseConfig;
export const app = firebaseApp;
export const db = firestoreDb;
export const auth = firebaseAuth;
