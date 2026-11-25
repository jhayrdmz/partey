import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from "firebase/firestore";
import { connectDatabaseEmulator, getDatabase, type Database } from "firebase/database";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { emulatorHost, firebaseConfig, functionsRegion, isFirebaseConfigured, useEmulators } from "./config";

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  database: Database;
  functions: Functions;
}

let services: FirebaseServices | null = null;

/** Lazily initialise Firebase once. Throws if configuration is missing. */
export function firebase(): FirebaseServices {
  if (services) return services;
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured. See .env.example.");

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  // Long-polling auto-detection keeps listeners alive behind restrictive TV/corporate networks.
  const firestore = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  const database = getDatabase(app);
  const functions = getFunctions(app, functionsRegion);

  if (useEmulators) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(firestore, emulatorHost, 8080);
    connectDatabaseEmulator(database, emulatorHost, 9000);
    connectFunctionsEmulator(functions, emulatorHost, 5001);
  }

  services = { app, auth, firestore, database, functions };
  return services;
}
