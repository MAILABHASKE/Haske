// src/firebaseConfig.js

import { initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";

import { getFirestore } from "firebase/firestore";



const firebaseConfig = {

  apiKey: "AIzaSyBR3tNW1IidpuVSL7evVTfZn1EFWW3eak8",

  authDomain: "haske-98a95.firebaseapp.com",

  projectId: "haske-98a95",

  storageBucket: "haske-98a95.firebasestorage.app",

  messagingSenderId: "618449217821",

  appId: "1:618449217821:web:8dd0a1d9f7d020baeb99f4",

  measurementId: "G-HMMPXF3FQ7"

};

// Initialize Firebase

const app = initializeApp(firebaseConfig);

const firestore = getFirestore(app);

const auth = getAuth(app);





export { firestore, auth };

