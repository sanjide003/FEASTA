/// <reference types="vite/client" />

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
