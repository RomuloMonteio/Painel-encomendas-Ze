import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getFunctions }    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

// ─── PREENCHA COM AS CREDENCIAIS DO SEU PROJETO FIREBASE ──────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBfGtu8dFE7PSIdMorFa963GuJmoDqQ60I",
  authDomain:        "gestao-de-encomendas-ze.firebaseapp.com",
  projectId:         "gestao-de-encomendas-ze",
  storageBucket:     "gestao-de-encomendas-ze.firebasestorage.app",
  messagingSenderId: "711422121933",
  appId:             "1:711422121933:web:5f73ad875ac76899889684",
};
// ──────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const functions = getFunctions(app);
