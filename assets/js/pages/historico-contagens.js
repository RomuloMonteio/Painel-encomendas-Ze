import { initPage }     from '../layout.js';
import { db }            from '../firebase.js';
import { MARCAS }        from '../data.js';
import { gerarPDFContagem } from '../pdf.js';
import {
  collection, query, orderBy, limit, getDocs,
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
      const badgeMap = { 'super-bock': 'badge-sb', 'sumol': 'badge-sumol', 'cozinha': 'badge-cozinha' };
      const marcaCls = badgeMap[cnt.marcaSlug] ?? 'badge-sb';
      return `
        <tr>
          <td>${formatDt(cnt.createdAt)}</td>
          <td><span class="badge-estado ${marcaCls}">${cnt.marcaNome}</span></td>
          <td>${cnt.userNome ?? '—'}</td>
          <td class="text-center"><strong>${total}</strong></td>
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
          abrirModalContagem(cnt);
        }
      });
    });
  }

  renderPaginacao(filtradas.length, totalPags);
}

// ─── Modal de detalhe ─────────────────────────────────────────────────────
function abrirModalContagem(cnt) {
  const d = cnt.createdAt?.toDate ? cnt.createdAt.toDate() : new Date();
  const dataStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  const horaStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  document.getElementById('modal-titulo').textContent =
    `Contagem de Stock — ${cnt.marcaNome}`;
  document.getElementById('modal-subtitulo').textContent =
    `${dataStr} às ${horaStr}  ·  ${cnt.userNome ?? '—'}`;

  // Cor do cabeçalho conforme marca
  const cor = cnt.marcaCor ?? '#003087';
  document.getElementById('modal-header').style.borderTop = `4px solid ${cor}`;

  // Agrupar itens por categoria
  const cats = {};
  (cnt.itens ?? []).forEach(item => {
    const c = item.categoria ?? 'Outros';
    if (!cats[c]) cats[c] = { tipo: item.tipo, itens: [] };
    cats[c].itens.push(item);
  });

  let html = '';

  Object.entries(cats).forEach(([catNome, { tipo, itens }]) => {
    html += `
      <div style="margin-bottom:1.25rem;">
        <div style="background:#f1f5f9;border-left:3px solid ${cor};padding:.4rem .75rem;border-radius:0 4px 4px 0;margin-bottom:.5rem;">
          <strong style="font-size:.82rem;color:#475569;">${catNome}</strong>
        </div>`;

    if (tipo === 'barril') {
      html += `
        <table class="table-modern" style="font-size:.85rem;">
          <thead><tr>
            <th>Produto</th>
            <th class="text-center" style="color:#16a34a;">Em uso</th>
            <th class="text-center" style="color:#dc2626;">Vazia(s)</th>
            <th class="text-center" style="color:#2563eb;">Reserva</th>
            <th>Nota</th>
          </tr></thead>
          <tbody>
            ${itens.map(i => `
              <tr>
                <td><strong>${i.nome}</strong></td>
                <td class="text-center" style="font-weight:700;color:#16a34a;">${i.emUso ?? 0}</td>
                <td class="text-center" style="font-weight:700;color:#dc2626;">${i.vazias ?? 0}</td>
                <td class="text-center" style="font-weight:700;color:#2563eb;">${i.reserva ?? 0}</td>
                <td style="color:#64748b;font-style:italic;">${i.nota || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;

    } else if (tipo === 'stock') {
      const totalQty = itens.reduce((s, i) => s + (i.quantidade ?? i.atual ?? 0), 0);
      html += `
        <table class="table-modern" style="font-size:.85rem;">
          <thead><tr>
            <th>Produto</th>
            <th class="text-center" style="color:#7c3aed;">Quantidade</th>
            <th>Nota</th>
          </tr></thead>
          <tbody>
            ${itens.map(i => `
              <tr>
                <td><strong>${i.nome}</strong></td>
                <td class="text-center" style="font-weight:700;color:#7c3aed;">${i.quantidade ?? i.atual ?? 0} ${i.unidade ?? ''}</td>
                <td style="color:#64748b;font-style:italic;">${i.nota || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div style="text-align:right;margin-top:.35rem;font-size:.8rem;color:#64748b;">
          Total: <strong style="color:#7c3aed;">${totalQty}</strong>
        </div>`;

    } else {
      // garrafas
      html += `
        <table class="table-modern" style="font-size:.85rem;">
          <thead><tr>
            <th>Produto</th>
            <th class="text-center" style="color:#7c3aed;">Quantidade</th>
            <th>Nota</th>
          </tr></thead>
          <tbody>
            ${itens.map(i => `
              <tr>
                <td><strong>${i.nome}</strong></td>
                <td class="text-center" style="font-weight:700;color:#7c3aed;">${(i.quantidade ?? 0) > 0 ? `${i.quantidade} ${i.unidade ?? ''}` : '—'}</td>
                <td style="color:#64748b;font-style:italic;">${i.nota || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    }

    html += `</div>`;
  });

  if (cnt.observacoes) {
    html += `
      <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;margin-top:.5rem;">
        <strong style="font-size:.8rem;color:#64748b;">Observações</strong>
        <p style="margin:0;margin-top:.25rem;font-size:.875rem;">${cnt.observacoes}</p>
      </div>`;
  }

  if (!html) {
    html = `<p class="text-muted text-center py-3">Sem dados para mostrar.</p>`;
  }

  document.getElementById('modal-body').innerHTML = html;

  // Botão PDF no modal
  const btnPdf = document.getElementById('modal-btn-pdf');
  btnPdf.onclick = () => gerarPDFContagem(cnt);

  new bootstrap.Modal(document.getElementById('modalContagem')).show();
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
