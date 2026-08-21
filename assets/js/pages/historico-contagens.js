import { initPage }     from '../layout.js';
import { db }            from '../firebase.js';
import { MARCAS }        from '../data.js';
import { gerarPDFContagem } from '../pdf.js';
import { abrirModalContagem } from '../contagem-modal.js';
import {
  collection, query, orderBy, limit, getDocs,
  doc, deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const POR_PAGINA = 20;
let todasContagens = [];
let paginaAtual    = 1;

function formatDt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `<span>${d.toLocaleDateString('pt-PT')}</span><br>
          <small>${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</small>`;
}

function resumoItens(itens = []) {
  const total   = itens.length;
  const aPedir  = itens.filter(i => i.tipo === 'stock' && (i.aPedir ?? 0) > 0).length;
  return { total, aPedir };
}

// ─── Filtrar ──────────────────────────────────────────────────────────────
function filtrar(contagens) {
  const marcaId    = document.getElementById('f-marca').value;
  const dataInicio = document.getElementById('f-inicio').value;
  const dataFim    = document.getElementById('f-fim').value;

  return contagens.filter(c => {
    if (marcaId && c.marcaSlug !== marcaId) return false;
    const d = c.createdAt?.toDate ? c.createdAt.toDate() : null;
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
  const filtradas  = filtrar(todasContagens);
  const inicio     = (paginaAtual - 1) * POR_PAGINA;
  const pagina     = filtradas.slice(inicio, inicio + POR_PAGINA);
  const totalPags  = Math.ceil(filtradas.length / POR_PAGINA);

  document.getElementById('total-badge').textContent = filtradas.length;

  const tbody = document.getElementById('tbody-contagens');
  if (!pagina.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">
      <i class="fas fa-inbox me-2 opacity-50"></i>Sem contagens registadas</td></tr>`;
  } else {
    tbody.innerHTML = pagina.map(cnt => {
      const { total, aPedir } = resumoItens(cnt.itens);
      const badgeMap = {
        'super-bock': 'badge-sb', 'sumol': 'badge-sumol',
        'cozinha-domingo': 'badge-cozinha', 'cozinha-segunda': 'badge-cozinha', 'cozinha-legado': 'badge-cozinha',
      };
      const marcaCls = badgeMap[cnt.marcaSlug] ?? 'badge-sb';
      const nome = cnt.userNome ?? '—';
      const nomeDisplay = nome.length > 6 ? nome.substring(0, 6) + '…' : nome;
      return `
        <tr>
          <td>${formatDt(cnt.createdAt)}</td>
          <td><span class="badge-estado ${marcaCls}">${cnt.marcaNome}</span></td>
          <td class="d-none d-md-table-cell">${nomeDisplay}</td>
          <td class="text-center d-none d-md-table-cell"><strong>${total}</strong></td>
          <td class="text-center">
            ${aPedir > 0
              ? `<span class="badge-estado badge-enviada"><i class="fas fa-arrow-up me-1"></i>${aPedir} a pedir</span>`
              : `<span class="badge-estado badge-entregue"><i class="fas fa-check me-1"></i>Stock ok</span>`}
          </td>
          <td>
            <div class="d-flex gap-1">
              <button class="btn-outline-custom py-1 px-2"
                      style="font-size:.78rem;"
                      data-cnt-idx="${todasContagens.indexOf(cnt)}"
                      data-action="ver"
                      title="Ver contagem">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn-outline-custom py-1 px-2"
                      style="font-size:.78rem;color:#dc2626;border-color:#fca5a5;"
                      data-cnt-idx="${todasContagens.indexOf(cnt)}"
                      data-action="pdf"
                      title="Gerar PDF">
                <i class="fas fa-file-pdf"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-cnt-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cnt = todasContagens[parseInt(btn.dataset.cntIdx, 10)];
        if (!cnt) return;
        if (btn.dataset.action === 'pdf') {
          gerarPDFContagem(cnt);
        } else {
          abrirModalContagem(cnt, { onApagar: apagarContagem });
        }
      });
    });
  }

  renderPaginacao(filtradas.length, totalPags);
}

// ─── Apagar contagem ─────────────────────────────────────────────────────
async function apagarContagem(cnt) {
  const d = cnt.createdAt?.toDate ? cnt.createdAt.toDate() : new Date();
  const dataStr = d.toLocaleDateString('pt-PT');
  if (!confirm(`Apagar a contagem de ${cnt.marcaNome} de ${dataStr}?\nEsta ação não pode ser desfeita.`)) return;

  try {
    await deleteDoc(doc(db, 'contagens', cnt.id));
    const idx = todasContagens.indexOf(cnt);
    if (idx > -1) todasContagens.splice(idx, 1);
    bootstrap.Modal.getInstance(document.getElementById('modalContagem'))?.hide();
    renderizar();
  } catch (err) {
    console.error(err);
    alert('Erro ao apagar. Verifique as permissões e tente novamente.');
  }
}

function renderPaginacao(total, totalPags) {
  const container = document.getElementById('paginacao');
  const inicio    = (paginaAtual - 1) * POR_PAGINA + 1;
  const fim       = Math.min(paginaAtual * POR_PAGINA, total);

  document.getElementById('pag-info').textContent =
    total > 0 ? `A mostrar ${inicio}–${fim} de ${total}` : '';

  if (totalPags <= 1) { container.innerHTML = ''; return; }

  let html = `<a class="page-btn ${paginaAtual === 1 ? 'disabled' : ''}" data-p="${paginaAtual - 1}"><i class="fas fa-chevron-left"></i></a>`;
  for (let p = Math.max(1, paginaAtual - 2); p <= Math.min(totalPags, paginaAtual + 2); p++) {
    html += `<a class="page-btn ${p === paginaAtual ? 'active' : ''}" data-p="${p}">${p}</a>`;
  }
  html += `<a class="page-btn ${paginaAtual >= totalPags ? 'disabled' : ''}" data-p="${paginaAtual + 1}"><i class="fas fa-chevron-right"></i></a>`;
  container.innerHTML = html;

  container.querySelectorAll('[data-p]').forEach(btn =>
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.p);
      if (btn.classList.contains('disabled')) return;
      paginaAtual = p;
      renderizar();
    })
  );
}

// ─── onReady ──────────────────────────────────────────────────────────────
async function onReady() {
  // Select de marcas
  const fMarca = document.getElementById('f-marca');
  Object.entries(MARCAS).forEach(([slug, m]) => {
    fMarca.innerHTML += `<option value="${slug}">${m.nome}</option>`;
  });

  // Filtro da URL
  const params = new URLSearchParams(location.search);
  if (params.get('marca')) fMarca.value = params.get('marca');

  // Carregar contagens (até 200)
  const snap = await getDocs(query(
    collection(db, 'contagens'),
    orderBy('createdAt', 'desc'),
    limit(200)
  ));
  todasContagens = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderizar();

  ['f-marca', 'f-inicio', 'f-fim'].forEach(id =>
    document.getElementById(id).addEventListener('change', () => { paginaAtual = 1; renderizar(); })
  );
  document.getElementById('btn-limpar').addEventListener('click', () => {
    ['f-marca', 'f-inicio', 'f-fim'].forEach(id => { document.getElementById(id).value = ''; });
    paginaAtual = 1;
    renderizar();
  });
}

initPage({ pagina: 'historico-contagens', titulo: 'Histórico de Contagens', onReady });
