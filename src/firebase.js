import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB-QKUNxepmFPSboLhVBxJWkqNuvdWjJG8",
  authDomain: "mingo-2b220.firebaseapp.com",
  databaseURL: "https://mingo-2b220-default-rtdb.firebaseio.com",
  projectId: "mingo-2b220",
  storageBucket: "mingo-2b220.firebasestorage.app",
  messagingSenderId: "655844146751",
  appId: "1:655844146751:web:3e471139d1c6f30848c28a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
