import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const call = nome => httpsCallable(functions, nome);

export const criarUtilizador     = dados => call('adminCriarUtilizador')(dados).then(r => r.data);
export const atualizarUtilizador = dados => call('adminAtualizarUtilizador')(dados).then(r => r.data);
export const apagarUtilizador    = uid   => call('adminApagarUtilizador')({ uid }).then(r => r.data);
export const listarUtilizadores  = ()    => call('adminListarUtilizadores')().then(r => r.data);
