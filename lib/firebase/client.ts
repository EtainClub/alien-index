"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  linkWithPopup,
  setPersistence,
  signInWithPopup,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
};

let cachedServices: FirebaseServices | null = null;
let authPromise: Promise<User> | null = null;
let emulatorsConnected = false;
let appCheckInitialized = false;

export function getFirebaseServices(): FirebaseServices {
  if (!firebaseConfigured) throw new Error("firebase-not-configured");
  if (cachedServices) return cachedServices;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
  if (typeof window !== "undefined" && appCheckSiteKey && !appCheckInitialized) {
    if (process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN === "true") {
      (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
  }

  cachedServices = {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    functions: getFunctions(app, "asia-northeast3"),
    storage: getStorage(app),
  };

  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && !emulatorsConnected) {
    connectAuthEmulator(cachedServices.auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(cachedServices.firestore, "127.0.0.1", 8080);
    connectFunctionsEmulator(cachedServices.functions, "127.0.0.1", 5001);
    connectStorageEmulator(cachedServices.storage, "127.0.0.1", 9199);
    emulatorsConnected = true;
  }

  return cachedServices;
}

export async function ensureAnonymousUser(): Promise<User> {
  const { auth } = getFirebaseServices();
  if (auth.currentUser) return auth.currentUser;
  if (authPromise) return authPromise;

  authPromise = (async () => {
    await setPersistence(auth, browserLocalPersistence);
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser;
    return (await signInAnonymously(auth)).user;
  })();

  try {
    return await authPromise;
  } finally {
    authPromise = null;
  }
}

export async function signInWithGoogle(): Promise<User> {
  const { auth } = getFirebaseServices();
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  const currentUser = auth.currentUser;

  if (currentUser?.isAnonymous) {
    try {
      const linkedUser = (await linkWithPopup(currentUser, provider)).user;
      await linkedUser.getIdToken(true);
      return linkedUser;
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/credential-already-in-use") throw error;
    }
  }

  const signedInUser = (await signInWithPopup(auth, provider)).user;
  await signedInUser.getIdToken(true);
  return signedInUser;
}
