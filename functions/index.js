const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1' });

const NIVEIS_VALIDOS = ['admin', 'funcionario'];

async function assertIsAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  if (!snap.exists || snap.data().nivel !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas administradores podem executar esta ação.');
  }
}

function mapAuthError(err) {
  const mensagens = {
    'auth/email-already-exists': 'Já existe uma conta com este email.',
    'auth/invalid-email': 'Email inválido.',
    'auth/invalid-password': 'A password deve ter pelo menos 6 caracteres.',
    'auth/user-not-found': 'Utilizador não encontrado.',
  };
  if (mensagens[err.code]) {
    return new HttpsError(err.code === 'auth/email-already-exists' ? 'already-exists' : 'invalid-argument', mensagens[err.code]);
  }
  console.error(err);
  return new HttpsError('internal', 'Ocorreu um erro inesperado. Tente novamente.');
}

// ─── Criar utilizador ────────────────────────────────────────────────────
exports.adminCriarUtilizador = onCall(async (request) => {
  await assertIsAdmin(request.auth?.uid);

  const { nome, email, password, nivel } = request.data ?? {};
  if (!nome || !email || !password || !NIVEIS_VALIDOS.includes(nivel)) {
    throw new HttpsError('invalid-argument', 'Preenche nome, email, password e nível corretamente.');
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({ email, password, displayName: nome });
  } catch (err) {
    throw mapAuthError(err);
  }

  await admin.firestore().doc(`users/${userRecord.uid}`).set({ nome, nivel });
  return { uid: userRecord.uid };
});

// ─── Atualizar utilizador ────────────────────────────────────────────────
exports.adminAtualizarUtilizador = onCall(async (request) => {
  await assertIsAdmin(request.auth?.uid);

  const { uid, nome, nivel, novaPassword } = request.data ?? {};
  if (!uid) throw new HttpsError('invalid-argument', 'Utilizador em falta.');
  if (nivel && !NIVEIS_VALIDOS.includes(nivel)) {
    throw new HttpsError('invalid-argument', 'Nível inválido.');
  }
  if (uid === request.auth.uid && nivel && nivel !== 'admin') {
    throw new HttpsError('failed-precondition', 'Não podes remover o teu próprio nível de administrador.');
  }

  const authUpdates = {};
  if (novaPassword) authUpdates.password = novaPassword;
  if (nome) authUpdates.displayName = nome;
  if (Object.keys(authUpdates).length) {
    try {
      await admin.auth().updateUser(uid, authUpdates);
    } catch (err) {
      throw mapAuthError(err);
    }
  }

  const firestoreUpdates = {};
  if (nome)  firestoreUpdates.nome  = nome;
  if (nivel) firestoreUpdates.nivel = nivel;
  if (Object.keys(firestoreUpdates).length) {
    await admin.firestore().doc(`users/${uid}`).set(firestoreUpdates, { merge: true });
  }

  return { ok: true };
});

// ─── Apagar utilizador ───────────────────────────────────────────────────
exports.adminApagarUtilizador = onCall(async (request) => {
  await assertIsAdmin(request.auth?.uid);

  const { uid } = request.data ?? {};
  if (!uid) throw new HttpsError('invalid-argument', 'Utilizador em falta.');
  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'Não podes apagar a tua própria conta.');
  }

  try {
    await admin.auth().deleteUser(uid);
  } catch (err) {
    throw mapAuthError(err);
  }
  await admin.firestore().doc(`users/${uid}`).delete();

  return { ok: true };
});

// ─── Listar utilizadores ─────────────────────────────────────────────────
exports.adminListarUtilizadores = onCall(async (request) => {
  await assertIsAdmin(request.auth?.uid);

  const [authList, firestoreSnap] = await Promise.all([
    admin.auth().listUsers(1000),
    admin.firestore().collection('users').get(),
  ]);

  const perfis = new Map(firestoreSnap.docs.map(d => [d.id, d.data()]));

  return authList.users.map(u => ({
    uid: u.uid,
    email: u.email,
    nome: perfis.get(u.uid)?.nome ?? u.displayName ?? '—',
    nivel: perfis.get(u.uid)?.nivel ?? 'funcionario',
    criadoEm: u.metadata.creationTime,
    ultimoLogin: u.metadata.lastSignInTime ?? null,
  }));
});
