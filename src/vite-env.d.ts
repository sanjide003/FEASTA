/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '../../firebase-runtime-config.js' {
  export const firebaseConfig: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    measurementId?: string;
  };
}
