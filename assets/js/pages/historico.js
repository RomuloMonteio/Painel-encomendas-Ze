import { initPage } from '../layout.js';
import { db }        from '../firebase.js';
import { MARCAS }    from '../data.js';
import { gerarPDF }  from '../pdf.js';
import {
  collection, query, where, orderBy, limit,
  getDocs, updateDoc, doc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const POR_PAGINA = 20;
let todasEncomendas = [];
let paginaAtual     = 1;

function formatDt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `<span>${d.toLocaleDateString('pt-PT')}</span><br><small>${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</small>`;
}

function badgeEstado(estado) {
  const m = { enviada: 'badge-enviada', confirmada: 'badge-confirmada', entregue: 'badge-entregue', cancelada: 'badge-cancelada' };
  return `<span class="badge-estado ${m[estado] ?? ''}">${estado.charAt(0).toUpperCase() + estado.slice(1)}</span>`;
}

// ─── Filtrar client-side ──────────────────────────────────────────────────
function filtrar(encomendas) {
  const marcaId   = document.getElementById('f-marca').value;
  const estado    = document.getElementById('f-estado').value;
  const dataInicio = document.getElementById('f-inicio').value;
  const dataFim    = document.getElementById('f-fim').value;

  return encomendas.filter(enc => {
    if (marcaId   && enc.marcaSlug !== marcaId) return false;
    if (estado    && enc.estado    !== estado)  return false;
    const d = enc.createdAt?.toDate ? enc.createdAt.toDate() : null;
    if (d) {
      const iso = d.toISOString().split('T')[0];
      if (dataInicio && iso < dataInicio) return false;
      if (dataFim    && iso > dataFim)    return false;
    }
    return true;
  });
}

// ─── Renderizar tabela ────────────────────────────────────────────────────
function renderizar() {
  const filtradas = filtrar(todasEncomendas);
  const inicio    = (paginaAtual - 1) * POR_PAGINA;
  const pagina    = filtradas.slice(inicio, inicio + POR_PAGINA);
  const totalPags = Math.ceil(filtradas.length / POR_PAGINA);

  document.getElementById('total-badge').textContent = filtradas.length;

  const tbody = document.getElementById('tbody-historico');
  if (!pagina.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted"><i class="fas fa-inbox me-2 opacity-50"></i>Sem encomendas</td></tr>`;
  } else {
    tbody.innerHTML = pagina.map(enc => `
      <tr>
        <td><strong>${enc.numero}</strong></td>
        <td><span class="badge-estado ${enc.marcaSlug === 'super-bock' ? 'badge-sb' : 'badge-sumol'}">${enc.marcaNome}</span></td>
        <td>${enc.userNome ?? '—'}</td>
        <td><strong>${enc.totalQuantidade ?? 0}</strong> <span class="text-muted" style="font-size:.78rem;">unid.</span></td>
        <td>
          <select class="form-select form-select-sm estado-select"
                  style="font-size:.75rem;padding:.2rem .5rem;min-width:115px;border-radius:20px;"
                  data-id="${enc.id}">
            ${['enviada','confirmada','entregue','cancelada'].map(s =>
              `<option value="${s}" ${enc.estado === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
            ).join('')}
          </select>
        </td>
        <td style="font-size:.82rem;color:var(--text-muted);">${formatDt(enc.createdAt)}</td>
        <td>
          <button class="btn-outline-custom py-1 px-2" style="font-size:.78rem;color:#dc2626;border-color:#fca5a5;"
                  data-pdf-id="${enc.id}" title="Gerar PDF">
            <i class="fas fa-file-pdf"></i>
          </button>
        </td>
      </tr>`).join('');

    // Estado change
    tbody.querySelectorAll('.estado-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        await updateDoc(doc(db, 'encomendas', sel.dataset.id), { estado: sel.value });
        const enc = todasEncomendas.find(e => e.id === sel.dataset.id);
        if (enc) enc.estado = sel.value;
      });
    });

    // PDF buttons
    tbody.querySelectorAll('[data-pdf-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const enc = todasEncomendas.find(e => e.id === btn.dataset.pdfId);
        if (enc) gerarPDF(enc);
      });
    });
  }

  // Paginação
  renderPaginacao(filtradas.length, totalPags);
}

function renderPaginacao(total, totalPags) {
  const container = document.getElementById('paginacao');
  const inicio    = (paginaAtual - 1) * POR_PAGINA + 1;
  const fim       = Math.min(paginaAtual * POR_PAGINA, total);

  document.getElementById('pag-info').textContent = total > 0 ? `A mostrar ${inicio}–${fim} de ${total}` : '';

  if (totalPags <= 1) { container.innerHTML = ''; return; }

  let html = `<a class="page-btn ${paginaAtual === 1 ? 'disabled' : ''}" data-p="${paginaAtual - 1}"><i class="fas fa-chevron-left"></i></a>`;
  for (let p = Math.max(1, paginaAtual - 2); p <= Math.min(totalPags, paginaAtual + 2); p++) {
    html += `<a class="page-btn ${p === paginaAtual ? 'active' : ''}" data-p="${p}">${p}</a>`;
  }
  html += `<a class="page-btn ${paginaAtual >= totalPags ? 'disabled' : ''}" data-p="${paginaAtual + 1}"><i class="fas fa-chevron-right"></i></a>`;
  container.innerHTML = html;

  container.querySelectorAll('[data-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.p);
      if (p < 1 || p > totalPags || btn.classList.contains('disabled')) return;
      paginaAtual = p;
      renderizar();
    });
  });
}

async function onReady() {
  // Preencher select de marcas
  const fMarca = document.getElementById('f-marca');
  Object.entries(MARCAS).forEach(([slug, m]) => {
    fMarca.innerHTML += `<option value="${slug}">${m.nome}</option>`;
  });

  // Filtros da URL
  const params = new URLSearchParams(location.search);
  if (params.get('estado')) document.getElementById('f-estado').value = params.get('estado');
  if (params.get('marca'))  document.getElementById('f-marca').value  = params.get('marca');

  // Carregar encomendas (até 200 — suficiente para restaurante)
  const snap = await getDocs(query(
    collection(db, 'encomendas'),
    orderBy('createdAt', 'desc'),
    limit(200)
  ));
  todasEncomendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderizar();

  // Filtros
  ['f-marca', 'f-estado', 'f-inicio', 'f-fim'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { paginaAtual = 1; renderizar(); });
  });
  document.getElementById('btn-limpar').addEventListener('click', () => {
    ['f-marca', 'f-estado', 'f-inicio', 'f-fim'].forEach(id => { document.getElementById(id).value = ''; });
    paginaAtual = 1;
    renderizar();
  });
}

initPage({ pagina: 'historico', titulo: 'Histórico de Encomendas', onReady });
