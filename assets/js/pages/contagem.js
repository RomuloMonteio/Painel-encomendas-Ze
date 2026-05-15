import { initPage }                 from '../layout.js';
import { db }                        from '../firebase.js';
import { MARCAS, CONTAGEM_PRODUTOS } from '../data.js';
import { gerarPDFContagem }          from '../pdf.js';
import {
  collection, addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const marcaSlug = new URLSearchParams(location.search).get('marca') ?? 'super-bock';
const marca     = MARCAS[marcaSlug];

if (!marca) { location.href = 'dashboard.html'; }

// ─── Construir formulário ─────────────────────────────────────────────────
function buildForm() {
  const container = document.getElementById('form-contagem');
  const cats      = CONTAGEM_PRODUTOS[marcaSlug] ?? [];

  cats.forEach(cat => {
    const isBarril = cat.tipo === 'barril';
    const isStock  = cat.tipo === 'stock';   // mínimo + a pedir

    const card = document.createElement('div');
    card.className = 'categoria-card';

    // Cabeçalho com legenda inline
    let legendaHTML = '';
    if (isBarril) {
      legendaHTML = `
        <div style="padding:.45rem 1.25rem .6rem;display:flex;gap:1rem;font-size:.72rem;background:#f8fafc;border-bottom:1px solid var(--border);">
          <span style="color:#16a34a;font-weight:700;"><i class="fas fa-circle me-1" style="font-size:.45rem"></i>Em uso</span>
          <span style="color:#dc2626;font-weight:700;"><i class="fas fa-circle me-1" style="font-size:.45rem"></i>Vazia(s)</span>
          <span style="color:#2563eb;font-weight:700;"><i class="fas fa-circle me-1" style="font-size:.45rem"></i>Reserva</span>
        </div>`;
    } else if (isStock) {
      legendaHTML = `
        <div style="padding:.45rem 1.25rem .6rem;display:flex;gap:1rem;font-size:.72rem;background:#f8fafc;border-bottom:1px solid var(--border);">
          <span style="color:#7c3aed;font-weight:700;"><i class="fas fa-circle me-1" style="font-size:.45rem"></i>Atual</span>
          <span style="color:#64748b;font-weight:600;">Mínimo: ${cat.minimo ?? 5}</span>
          <span style="color:#dc2626;font-weight:700;"><i class="fas fa-circle me-1" style="font-size:.45rem"></i>A pedir = mín − atual</span>
        </div>`;
    }

    const produtosHTML = cat.produtos.map(p => {
      let camposHTML;

      if (isBarril) {
        camposHTML = `
          <div class="contagem-campos">
            <div class="contagem-campo">
              <label>Em uso</label>
              <input type="number" class="cnt-em-uso" data-field="emUso"
                     data-produto-id="${p.id}" min="0" value="0">
            </div>
            <div class="cnt-separador"></div>
            <div class="contagem-campo">
              <label>Vazia(s)</label>
              <input type="number" class="cnt-vazias" data-field="vazias"
                     data-produto-id="${p.id}" min="0" value="0">
            </div>
            <div class="cnt-separador"></div>
            <div class="contagem-campo">
              <label>Reserva</label>
              <input type="number" class="cnt-reserva" data-field="reserva"
                     data-produto-id="${p.id}" min="0" value="0">
            </div>
          </div>`;

      } else if (isStock) {
        const minimo = cat.minimo ?? 5;
        camposHTML = `
          <div class="contagem-campos">
            <div class="contagem-campo">
              <label>Atual</label>
              <input type="number" class="cnt-atual" data-field="atual"
                     data-produto-id="${p.id}"
                     data-minimo="${minimo}"
                     min="0" value="0">
            </div>
            <div class="cnt-stock-meta">
              <span class="cnt-minimo-label">mín. ${minimo}</span>
              <span class="cnt-apedir-badge baixo" data-apedir="${p.id}">
                <i class="fas fa-arrow-up"></i> pedir: ${minimo}
              </span>
            </div>
          </div>`;

      } else {
        // garrafa (qtd simples)
        camposHTML = `
          <div class="contagem-campos">
            <div class="contagem-campo">
              <label>${p.unidade ?? 'Qtd.'}</label>
              <input type="number" class="cnt-qty" data-field="quantidade"
                     data-produto-id="${p.id}" min="0" value="0">
            </div>
          </div>`;
      }

      return `
        <div class="contagem-row" data-produto-id="${p.id}">
          <div class="contagem-nome">
            <strong>${p.nome}</strong>
            ${isStock || (!isBarril) ? `<small>${p.unidade ?? ''}</small>` : ''}
          </div>
          ${camposHTML}
          <input type="text" class="contagem-nota-input"
                 data-field="nota" data-produto-id="${p.id}"
                 placeholder="Nota (ex: quase a acabar)">
        </div>`;
    }).join('');

    card.innerHTML = `
      <div class="categoria-header">
        <h6>
          <i class="fas ${isBarril ? 'fa-barrel' : 'fa-bottle-water'} me-2"
             style="color:${marca.cor};opacity:.7"></i>
          ${cat.categoria}
        </h6>
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-light text-muted" style="font-size:.72rem;">${cat.produtos.length} produtos</span>
          <i class="fas fa-chevron-down toggle-icon"></i>
        </div>
      </div>
      ${legendaHTML}
      <div class="categoria-body">${produtosHTML}</div>`;

    container.appendChild(card);
  });

  setupAccordion();
  setupHighlights();
}

// ─── Accordion ────────────────────────────────────────────────────────────
function setupAccordion() {
  document.querySelectorAll('.categoria-header').forEach(h => {
    h.addEventListener('click', () => {
      const body  = h.nextElementSibling;
      // pular a legenda se existir
      const target = body.classList.contains('categoria-body') ? body : body.nextElementSibling;
      const aberto = !h.classList.contains('collapsed');
      h.classList.toggle('collapsed', aberto);
      if (target) {
        target.style.maxHeight = aberto ? '0' : target.scrollHeight + 'px';
        target.style.overflow  = aberto ? 'hidden' : 'visible';
      }
    });
  });
}

// ─── Highlights + cálculo a-pedir ────────────────────────────────────────
function setupHighlights() {
  document.addEventListener('input', e => {
    const inp = e.target;
    if (!inp.matches('input[type="number"]')) return;

    const v = parseInt(inp.value, 10) || 0;
    inp.classList.toggle('has-value', v > 0);

    // Tipo stock: calcular "a pedir"
    if (inp.classList.contains('cnt-atual')) {
      const minimo  = parseInt(inp.dataset.minimo, 10) || 5;
      const aPedir  = Math.max(0, minimo - v);
      const badge   = document.querySelector(`.cnt-apedir-badge[data-apedir="${inp.dataset.produtoId}"]`);
      if (badge) {
        badge.innerHTML = aPedir > 0
          ? `<i class="fas fa-arrow-up"></i> pedir: ${aPedir}`
          : `<i class="fas fa-check"></i> ok`;
        badge.classList.toggle('ok',    aPedir === 0);
        badge.classList.toggle('baixo', aPedir > 0);
      }
      inp.classList.toggle('cnt-ok',    v >= minimo);
      inp.classList.toggle('cnt-baixo', v < minimo && v > 0);
    }
  });
}

// ─── Recolher dados do formulário ─────────────────────────────────────────
function recolherItens() {
  const cats = CONTAGEM_PRODUTOS[marcaSlug] ?? [];
  return cats.flatMap(cat =>
    cat.produtos.map(p => {
      const row  = document.querySelector(`.contagem-row[data-produto-id="${p.id}"]`);
      if (!row) return null;
      const get  = field => row.querySelector(`[data-field="${field}"]`)?.value ?? '';
      const getN = field => parseInt(get(field), 10) || 0;

      if (cat.tipo === 'barril') {
        return {
          produtoId: p.id,
          nome:      p.nome,
          categoria: cat.categoria,
          tipo:      'barril',
          emUso:     getN('emUso'),
          vazias:    getN('vazias'),
          reserva:   getN('reserva'),
          nota:      get('nota').trim(),
        };
      } else if (cat.tipo === 'stock') {
        const minimo = cat.minimo ?? 5;
        const atual  = getN('atual');
        return {
          produtoId:  p.id,
          nome:       p.nome,
          categoria:  cat.categoria,
          tipo:       'stock',
          unidade:    p.unidade ?? '',
          minimo,
          atual,
          aPedir:     Math.max(0, minimo - atual),
          nota:       get('nota').trim(),
        };
      } else {
        return {
          produtoId:  p.id,
          nome:       p.nome,
          categoria:  cat.categoria,
          tipo:       'garrafa',
          unidade:    p.unidade ?? '',
          quantidade: getN('quantidade'),
          nota:       get('nota').trim(),
        };
      }
    }).filter(Boolean)
  );
}

// ─── Sucesso ──────────────────────────────────────────────────────────────
function mostrarSucesso(contagem) {
  document.getElementById('estado-form').style.display    = 'none';
  document.getElementById('estado-sucesso').style.display = 'block';
  document.getElementById('btn-pdf-sucesso').addEventListener('click', () => gerarPDFContagem(contagem));
}

function mostrarErro(msg) {
  const el = document.getElementById('form-erro');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ─── onReady ──────────────────────────────────────────────────────────────
async function onReady(user, userData) {
  document.getElementById('marca-badge').style.background = marca.cor;
  document.getElementById('marca-badge').innerHTML =
    `<i class="fas ${marca.icon} me-2"></i>${marca.nome}`;

  buildForm();

  document.getElementById('formContagem').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>A guardar…'; }

    try {
      const payload = {
        userId:      user.uid,
        userNome:    userData.nome ?? user.email,
        marcaSlug,
        marcaNome:   marca.nome,
        marcaCor:    marca.cor,
        itens:       recolherItens(),
        observacoes: document.getElementById('observacoes').value.trim(),
        createdAt:   serverTimestamp(),
      };

      await addDoc(collection(db, 'contagens'), payload);
      mostrarSucesso({ ...payload, createdAt: { toDate: () => new Date() } });
    } catch (err) {
      console.error(err);
      mostrarErro('Erro ao guardar a contagem. Tente novamente.');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar Contagem'; }
    }
  });
}

initPage({ pagina: `contagem-${marcaSlug}`, titulo: `Contagem de Stock — ${marca?.nome ?? ''}`, onReady });
