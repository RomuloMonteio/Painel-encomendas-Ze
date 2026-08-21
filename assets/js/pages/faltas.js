import { initPage } from '../layout.js';
import { db }        from '../firebase.js';
import {
  collection, doc, addDoc, setDoc, updateDoc, getDoc, getDocs,
  query, orderBy, limit, serverTimestamp, increment, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let user, userData;
let cicloAtual   = null; // { id, dataLimite, entregue, ... }
let itensCiclo   = [];
const cacheItensHistorico = new Map(); // cicloId -> itens[]

// ─── Utilitários ───────────────────────────────────────────────────────────
const DIACRITICOS_RE = /[\u0300-\u036f]/g;

function slugify(nome) {
  return nome.toLowerCase()
    .normalize('NFD').replace(DIACRITICOS_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Data ISO (YYYY-MM-DD) da próxima terça-feira, incluindo hoje se hoje já for terça.
function proximaTercaISO(base = new Date()) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const diff = (2 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function formatDt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.toLocaleDateString('pt-PT')} às ${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
}

// ─── Firestore — ciclo ativo ───────────────────────────────────────────────
async function garantirCicloAtual() {
  const snap = await getDocs(query(collection(db, 'listasFalta'), orderBy('dataLimite', 'desc'), limit(1)));
  if (!snap.empty) {
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    if (!data.entregue) return { id: docSnap.id, ...data };
  }

  const novoId = proximaTercaISO();
  const ref = doc(db, 'listasFalta', novoId);
  const payload = {
    dataLimite:      Timestamp.fromDate(new Date(`${novoId}T00:00:00`)),
    entregue:        false,
    entregueEm:      null,
    entreguePor:     null,
    entreguePorNome: null,
    createdAt:       serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
  const criado = await getDoc(ref);
  return { id: novoId, ...criado.data() };
}

async function carregarItensCiclo(cicloId) {
  const snap = await getDocs(collection(db, 'listasFalta', cicloId, 'itens'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function registarNoCatalogo(nome) {
  const slug = slugify(nome);
  if (!slug) return;
  await setDoc(doc(db, 'faltasCatalogo', slug), {
    nome, vezesUsado: increment(1), ultimoUso: serverTimestamp(),
  }, { merge: true });
}

async function carregarCatalogo() {
  const snap = await getDocs(query(collection(db, 'faltasCatalogo'), orderBy('vezesUsado', 'desc'), limit(300)));
  return snap.docs.map(d => d.data().nome);
}

async function adicionarItem(cicloId, nome) {
  const nomeTrim = nome.trim();
  if (!nomeTrim) return;
  await addDoc(collection(db, 'listasFalta', cicloId, 'itens'), {
    nome: nomeTrim,
    adicionadoPor:     user.uid,
    adicionadoPorNome: userData.nome ?? user.email,
    adicionadoEm:      serverTimestamp(),
    completo:          false,
    completadoPor:     null,
    completadoPorNome: null,
    completadoEm:      null,
  });
  await registarNoCatalogo(nomeTrim);
}

async function marcarCompleto(itemId, completo) {
  await updateDoc(doc(db, 'listasFalta', cicloAtual.id, 'itens', itemId), {
    completo,
    completadoPor:     completo ? user.uid : null,
    completadoPorNome: completo ? (userData.nome ?? user.email) : null,
    completadoEm:      completo ? serverTimestamp() : null,
  });
}

async function marcarListaEntregue() {
  await updateDoc(doc(db, 'listasFalta', cicloAtual.id), {
    entregue:        true,
    entregueEm:      serverTimestamp(),
    entreguePor:     user.uid,
    entreguePorNome: userData.nome ?? user.email,
  });
}

async function carregarHistoricoCiclos() {
  const snap = await getDocs(query(collection(db, 'listasFalta'), orderBy('dataLimite', 'desc'), limit(20)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.entregue);
}

// ─── Render ─────────────────────────────────────────────────────────────────
function renderCicloInfo() {
  const d = cicloAtual.dataLimite?.toDate ? cicloAtual.dataLimite.toDate() : new Date(cicloAtual.dataLimite);
  document.getElementById('ciclo-info').textContent =
    `Entrega até terça-feira, ${d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })}`;
}

function renderPendentes() {
  const pendentes = itensCiclo
    .filter(i => !i.completo)
    .sort((a, b) => (a.adicionadoEm?.toMillis?.() ?? 0) - (b.adicionadoEm?.toMillis?.() ?? 0));

  document.getElementById('badge-pendentes').textContent = pendentes.length;
  const el = document.getElementById('lista-pendentes');

  el.innerHTML = !pendentes.length
    ? `<div class="text-center py-4 text-muted"><i class="fas fa-inbox me-2 opacity-50"></i>Sem itens pendentes</div>`
    : pendentes.map(item => `
        <div class="produto-row">
          <div class="form-check ms-1">
            <input class="form-check-input falta-checkbox" type="checkbox" data-item-id="${item.id}">
          </div>
          <div class="produto-info">
            <span class="produto-nome">${item.nome}</span>
            <div class="produto-meta">
              <span class="produto-unit">Adicionado por ${item.adicionadoPorNome ?? '—'}</span>
            </div>
          </div>
        </div>`).join('');
}

function renderCompletos() {
  const completos = itensCiclo
    .filter(i => i.completo)
    .sort((a, b) => (b.completadoEm?.toMillis?.() ?? 0) - (a.completadoEm?.toMillis?.() ?? 0));

  document.getElementById('badge-completos').textContent = completos.length;
  const el = document.getElementById('lista-completos');

  el.innerHTML = !completos.length
    ? `<div class="text-center py-4 text-muted"><i class="fas fa-box-open me-2 opacity-50"></i>Ainda nada comprado</div>`
    : completos.map(item => `
        <div class="produto-row">
          <div class="form-check ms-1">
            <input class="form-check-input falta-checkbox" type="checkbox" data-item-id="${item.id}" checked>
          </div>
          <div class="produto-info">
            <span class="produto-nome" style="text-decoration:line-through;color:var(--text-muted);">${item.nome}</span>
            <div class="produto-meta">
              <span class="produto-unit">Comprado por ${item.completadoPorNome ?? '—'}</span>
            </div>
          </div>
        </div>`).join('');
}

function renderDatalist(nomes) {
  document.getElementById('dl-catalogo-faltas').innerHTML =
    nomes.map(n => `<option value="${n}"></option>`).join('');
}

function renderHistoricoResumo(ciclos) {
  const el = document.getElementById('lista-historico');
  if (!ciclos.length) {
    el.innerHTML = `<div class="text-center py-3 text-muted">Sem ciclos entregues ainda.</div>`;
    return;
  }
  el.innerHTML = ciclos.map(c => `
    <div class="categoria-card mb-2">
      <div class="categoria-header" data-ciclo-id="${c.id}">
        <h6><i class="fas fa-calendar-check me-2" style="color:#16a34a;opacity:.8"></i>
          Entregue em ${formatDt(c.entregueEm)} por ${c.entreguePorNome ?? '—'}
        </h6>
        <i class="fas fa-chevron-down toggle-icon"></i>
      </div>
      <div class="categoria-body" id="itens-ciclo-${c.id}" style="padding:.5rem 1.25rem;display:none;">
        <span class="text-muted" style="font-size:.82rem;">A carregar…</span>
      </div>
    </div>`).join('');
}

async function renderItensHistoricoCiclo(cicloId) {
  const container = document.getElementById(`itens-ciclo-${cicloId}`);
  if (!container) return;

  const aberto = container.style.display !== 'none';
  if (aberto) { container.style.display = 'none'; return; }
  container.style.display = 'block';

  if (!cacheItensHistorico.has(cicloId)) {
    cacheItensHistorico.set(cicloId, await carregarItensCiclo(cicloId));
  }
  const itens = cacheItensHistorico.get(cicloId);

  container.innerHTML = !itens.length
    ? `<span class="text-muted" style="font-size:.82rem;">Sem itens.</span>`
    : itens.map(i => `
        <div class="d-flex align-items-center justify-content-between py-1" style="font-size:.85rem;border-bottom:1px solid var(--border);">
          <span style="${i.completo ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${i.nome}</span>
          <button type="button" class="btn-outline-custom py-1 px-2 btn-readicionar" style="font-size:.72rem;" data-nome="${i.nome}">
            <i class="fas fa-rotate-left me-1"></i>Readicionar
          </button>
        </div>`).join('');
}

// ─── Refresh ─────────────────────────────────────────────────────────────────
async function refreshItens() {
  itensCiclo = await carregarItensCiclo(cicloAtual.id);
  renderPendentes();
  renderCompletos();
}

// ─── onReady ──────────────────────────────────────────────────────────────
async function onReady(u, ud) {
  user = u; userData = ud;

  cicloAtual = await garantirCicloAtual();
  renderCicloInfo();
  await refreshItens();

  carregarCatalogo().then(renderDatalist);

  // Adicionar item
  document.getElementById('formAdicionarFalta').addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('input-item');
    const nome  = input.value.trim();
    if (!nome) return;
    input.disabled = true;
    try {
      await adicionarItem(cicloAtual.id, nome);
      input.value = '';
      await refreshItens();
      carregarCatalogo().then(renderDatalist);
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar o item. Tente novamente.');
    } finally {
      input.disabled = false;
      input.focus();
    }
  });

  // Toggle completo (delegado)
  document.addEventListener('change', async e => {
    if (!e.target.classList.contains('falta-checkbox')) return;
    const checkbox = e.target;
    checkbox.disabled = true;
    try {
      await marcarCompleto(checkbox.dataset.itemId, checkbox.checked);
      await refreshItens();
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar o item.');
      checkbox.disabled = false;
    }
  });

  // Marcar lista como entregue
  document.getElementById('btn-entregar').addEventListener('click', async () => {
    if (!confirm('Marcar esta lista como entregue? Uma nova lista vazia vai começar.')) return;
    const btn = document.getElementById('btn-entregar');
    btn.disabled = true;
    try {
      await marcarListaEntregue();
      cicloAtual = await garantirCicloAtual();
      renderCicloInfo();
      await refreshItens();
      document.getElementById('lista-historico').innerHTML = '';
      cacheItensHistorico.clear();
      if (document.getElementById('body-historico').style.display !== 'none') {
        renderHistoricoResumo(await carregarHistoricoCiclos());
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao marcar a lista como entregue.');
    } finally {
      btn.disabled = false;
    }
  });

  // Histórico — expandir/colapsar geral (lazy load)
  let historicoCarregado = false;
  document.getElementById('header-historico').addEventListener('click', async () => {
    const body = document.getElementById('body-historico');
    const icon = document.getElementById('icon-historico');
    const aberto = body.style.display !== 'none';
    body.style.display = aberto ? 'none' : 'block';
    icon.classList.toggle('fa-chevron-down', aberto);
    icon.classList.toggle('fa-chevron-up', !aberto);
    if (!aberto && !historicoCarregado) {
      historicoCarregado = true;
      renderHistoricoResumo(await carregarHistoricoCiclos());
    }
  });

  // Histórico — expandir um ciclo específico + readicionar item (delegado)
  document.getElementById('lista-historico').addEventListener('click', async e => {
    const header = e.target.closest('[data-ciclo-id]');
    if (header) { await renderItensHistoricoCiclo(header.dataset.cicloId); return; }

    const btnReadicionar = e.target.closest('.btn-readicionar');
    if (btnReadicionar) {
      btnReadicionar.disabled = true;
      try {
        await adicionarItem(cicloAtual.id, btnReadicionar.dataset.nome);
        await refreshItens();
        carregarCatalogo().then(renderDatalist);
      } catch (err) {
        console.error(err);
        alert('Erro ao readicionar o item.');
      } finally {
        btnReadicionar.disabled = false;
      }
    }
  });
}

initPage({ pagina: 'faltas', titulo: 'Lista de Faltas', onReady });
