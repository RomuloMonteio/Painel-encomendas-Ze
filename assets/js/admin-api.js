// Gestão de utilizadores sem backend próprio — o SDK do Firebase no browser
// não deixa um utilizador alterar a CONTA (login) de outro, só o seu perfil
// em Firestore. Contornamos isso onde é seguro fazê-lo sem servidor:
//  - Criar conta: uma segunda instância Firebase isolada cria a conta sem
//    afetar a sessão do admin que está autenticado na instância principal.
//  - Alterar password de outra pessoa: não é possível diretamente — em vez
//    disso enviamos um email de redefinição, que a própria pessoa usa.
//  - Apagar conta: não é possível sem backend — em vez disso "desativamos"
//    o perfil (users/{uid}.ativo = false), o que o auth guard usa para
//    bloquear o acesso mesmo que a conta continue a existir no Auth.
import { db, auth, firebaseConfig } from './firebase.js';
import {
  doc, setDoc, getDocs, collection,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  initializeApp, deleteApp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

function mapAuthError(err) {
  const mensagens = {
    'auth/email-already-in-use': 'Já existe uma conta com este email.',
    'auth/invalid-email':        'Email inválido.',
    'auth/weak-password':        'A password deve ter pelo menos 6 caracteres.',
    'auth/user-not-found':       'Não existe nenhuma conta com este email.',
  };
  console.error(err);
  return new Error(mensagens[err.code] ?? 'Ocorreu um erro inesperado. Tente novamente.');
}

export async function criarUtilizador({ nome, email, password, nivel }) {
  if (!nome || !email || !password || !['admin', 'funcionario'].includes(nivel)) {
    throw new Error('Preenche nome, email, password e nível corretamente.');
  }

  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    uid = cred.user.uid;
    await signOut(secondaryAuth);
  } catch (err) {
    throw mapAuthError(err);
  } finally {
    await deleteApp(secondaryApp);
  }

  await setDoc(doc(db, 'users', uid), { nome, email, nivel, ativo: true });
  return { uid };
}

export async function atualizarUtilizador({ uid, nome, nivel }) {
  const updates = {};
  if (nome)  updates.nome  = nome;
  if (nivel) updates.nivel = nivel;
  await setDoc(doc(db, 'users', uid), updates, { merge: true });
  return { ok: true };
}

export async function enviarResetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    throw mapAuthError(err);
  }
  return { ok: true };
}

export async function definirAtivo(uid, ativo) {
  await setDoc(doc(db, 'users', uid), { ativo }, { merge: true });
  return { ok: true };
}

export async function listarUtilizadores() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}
