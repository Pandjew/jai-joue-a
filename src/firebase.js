// src/firebase.js — initialisation Firebase + Firestore
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB4HjA7ZSZzTgH7K_DfB0eP-4nmeQ_PL7k",
  authDomain: "jaijouea-c6425.firebaseapp.com",
  projectId: "jaijouea-c6425",
  storageBucket: "jaijouea-c6425.firebasestorage.app",
  messagingSenderId: "1010919539773",
  appId: "1:1010919539773:web:e819a3ea1f92eca5539654",
  measurementId: "G-37LKY4LC5M",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
