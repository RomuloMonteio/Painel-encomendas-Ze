import { initPage } from '../layout.js';
import { criarUtilizador, atualizarUtilizador, apagarUtilizador, listarUtilizadores } from '../admin-api.js';

let currentUser = null;
let todosUtilizadores = [];
let modoEdicaoUid = null; // null = criar; senão = uid em edição

// ─── Erros ──────────────────────────────────────────────────────────────
// Nota: o elemento tem a classe utilitária .d-flex do Bootstrap, que define
// display:flex com !important — por isso escondê-lo exige setProperty com
// 'important' também, senão a classe vence sobre um style.display simples.
function esconder(el) { el.style.setProperty('display', 'none', 'important'); }
function mostrar(el)  { el.style.setProperty('display', 'flex', 'important'); }

function mostrarErro(msg) {
  const el = document.getElementById('form-erro');
  el.querySelector('span').textContent = msg;
  mostrar(el);
  setTimeout(() => esconder(el), 6000);
}

function mostrarErroModal(msg) {
  const el = document.getElementById('modal-form-erro');
  el.querySelector('span').textContent = msg;
  mostrar(el);
}

function limparErroModal() {
  esconder(document.getElementById('modal-form-erro'));
}

// ─── Renderizar tabela ────────────────────────────────────────────────────
function renderizar() {
  document.getElementById('total-badge').textContent = todosUtilizadores.length;
  const tbody = document.getElementById('tbody-utilizadores');

  if (!todosUtilizadores.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">
      <i class="fas fa-inbox me-2 opacity-50"></i>Sem utilizadores</td></tr>`;
    return;
  }

  tbody.innerHTML = todosUtilizadores.map(u => {
    const nivelBadge = u.nivel === 'admin'
      ? `<span class="badge-estado badge-confirmada">Administrador</span>`
      : `<span class="badge-estado badge-entregue">Funcionário</span>`;
    const podeApagar = u.uid !== currentUser.uid;
    return `
      <tr>
        <td><strong>${u.nome}</strong></td>
        <td>${u.email ?? '—'}</td>
        <td class="text-center">${nivelBadge}</td>
        <td>
          <div class="d-flex gap-1">
            <a class="btn-outline-custom py-1 px-2" style="font-size:.78rem;"
               href="historico-contagens.html?userId=${encodeURIComponent(u.uid)}&userNome=${encodeURIComponent(u.nome)}"
               title="Ver contagens">
              <i class="fas fa-eye"></i>
            </a>
            <button class="btn-outline-custom py-1 px-2" style="font-size:.78rem;"
                    data-action="editar" data-uid="${u.uid}" title="Editar">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn-outline-custom py-1 px-2" style="font-size:.78rem;color:#dc2626;border-color:#fca5a5;"
                    data-action="apagar" data-uid="${u.uid}" title="Apagar"
                    ${podeApagar ? '' : 'disabled'}>
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-action="editar"]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditar(btn.dataset.uid));
  });
  tbody.querySelectorAll('[data-action="apagar"]').forEach(btn => {
    btn.addEventListener('click', () => confirmarApagar(btn.dataset.uid));
  });
}

async function carregarLista() {
  const tbody = document.getElementById('tbody-utilizadores');
  tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">
    <i class="fas fa-spinner fa-spin me-2"></i>A carregar…</td></tr>`;
  try {
    todosUtilizadores = await listarUtilizadores();
    todosUtilizadores.sort((a, b) => a.nome.localeCompare(b.nome));
    renderizar();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">
      <i class="fas fa-triangle-exclamation me-2"></i>Erro ao carregar utilizadores</td></tr>`;
    mostrarErro(err.message ?? 'Erro ao carregar utilizadores.');
  }
}

// ─── Modal ──────────────────────────────────────────────────────────────
function abrirModalCriar() {
  modoEdicaoUid = null;
  limparErroModal();
  document.getElementById('modal-utilizador-titulo').textContent = 'Novo Utilizador';
  document.getElementById('formUtilizador').reset();
  document.getElementById('input-email').disabled = false;
  document.getElementById('wrapper-email').style.display = 'block';
  document.getElementById('input-password').required = true;
  document.getElementById('label-password').textContent = 'Password';
  document.getElementById('hint-password').textContent = 'Mínimo 6 caracteres.';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalUtilizador')).show();
}

function abrirModalEditar(uid) {
  const u = todosUtilizadores.find(x => x.uid === uid);
  if (!u) return;
  modoEdicaoUid = uid;
  limparErroModal();
  document.getElementById('modal-utilizador-titulo').textContent = `Editar — ${u.nome}`;
  document.getElementById('input-nome').value  = u.nome;
  document.getElementById('input-email').value = u.email ?? '';
  document.getElementById('wrapper-email').style.display = 'block';
  document.getElementById('input-email').disabled = true;
  document.getElementById('input-password').value = '';
  document.getElementById('input-password').required = false;
  document.getElementById('label-password').textContent = 'Nova Password (opcional)';
  document.getElementById('hint-password').textContent = 'Deixar em branco para não alterar.';
  document.getElementById('input-nivel').value = u.nivel;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalUtilizador')).show();
}

async function confirmarApagar(uid) {
  const u = todosUtilizadores.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`Apagar o utilizador "${u.nome}" (${u.email})?\nEsta ação não pode ser desfeita — a conta deixa de conseguir entrar.`)) return;
  try {
    await apagarUtilizador(uid);
    await carregarLista();
  } catch (err) {
    console.error(err);
    mostrarErro(err.message ?? 'Erro ao apagar utilizador.');
  }
}

// ─── onReady ──────────────────────────────────────────────────────────────
async function onReady(user, userData) {
  // Proteção só de UX — a segurança real está nas Cloud Functions e nas Firestore rules.
  if (userData.nivel !== 'admin') { window.location.href = 'dashboard.html'; return; }

  currentUser = user;
  await carregarLista();

  document.getElementById('btn-novo-utilizador').addEventListener('click', abrirModalCriar);

  document.getElementById('formUtilizador').addEventListener('submit', async e => {
    e.preventDefault();
    limparErroModal();

    const nome     = document.getElementById('input-nome').value.trim();
    const email    = document.getElementById('input-email').value.trim();
    const password = document.getElementById('input-password').value;
    const nivel    = document.getElementById('input-nivel').value;

    const btn = document.getElementById('btn-guardar-utilizador');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>A guardar…';

    try {
      if (modoEdicaoUid) {
        await atualizarUtilizador({ uid: modoEdicaoUid, nome, nivel, novaPassword: password || undefined });
      } else {
        await criarUtilizador({ nome, email, password, nivel });
      }
      bootstrap.Modal.getInstance(document.getElementById('modalUtilizador'))?.hide();
      await carregarLista();
    } catch (err) {
      console.error(err);
      mostrarErroModal(err.message ?? 'Erro ao guardar utilizador.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar';
    }
  });
}

initPage({ pagina: 'utilizadores', titulo: 'Utilizadores', onReady });
