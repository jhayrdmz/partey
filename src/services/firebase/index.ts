export { firebase } from "./app";
export { isFirebaseConfigured, missingConfigKeys, useEmulators } from "./config";
export { ensureSignedIn, watchAuth } from "./auth";
export { call, errorMessage, errorCode } from "./functions";
export { refs, fetchDoc, subscribeDoc, subscribeQuery, type WithId, type Unsubscribe } from "./firestore";
export { startPresence } from "./presence";
