import { initPage }       from '../layout.js';
import { db }              from '../firebase.js';
import { MARCAS, CATEGORIAS } from '../data.js';
import { gerarPDF }        from '../pdf.js';
import {
  collection, doc, addDoc, runTransaction, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const marcaSlug = new URLSearchParams(location.search).get('marca') ?? '';
const marca     = MARCAS[marcaSlug];

if (!marca) { location.href = 'dashboard.html'; }

// ─── Número de encomenda atómico ──────────────────────────────────────────
async function gerarNumero() {
  const ano        = new Date().getFullYear();
  const counterRef = doc(db, 'meta', 'counter');
  return await runTransaction(db, async t => {
    const snap  = await t.get(counterRef);
    const dados = snap.exists() ? snap.data() : {};
    const chave = `total_${ano}`;
    const n     = (dados[chave] ?? 0) + 1;
    t.set(counterRef, { ...dados, [chave]: n }, { merge: true });
    return `ENC-${ano}-${String(n).padStart(4, '0')}`;
  });
}

// ─── Construir formulário ─────────────────────────────────────────────────
function buildForm() {
  const container = document.getElementById('form-categorias');
  const cats      = CATEGORIAS[marcaSlug] ?? [];

  cats.forEach(cat => {
    const el = document.createElement('div');
    el.className = 'categoria-card';
    el.innerHTML = `
      <div class="categoria-header">
        <h6><i class="fas fa-tag me-2" style="color:${marca.cor};opacity:.7"></i>${cat.nome}</h6>
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-light text-muted" style="font-size:.72rem;">${cat.produtos.length} produtos</span>
          <i class="fas fa-chevron-down toggle-icon"></i>
        </div>
      </div>
      <div class="categoria-body">
        ${cat.produtos.map(p => `
          <div class="produto-row">
            <div class="produto-info">
              <span class="produto-nome">${p.nome}</span>
              <div class="produto-meta">
                <span class="produto-ref">${p.ref}</span>
                <span class="produto-unit">${p.unidade}</span>
              </div>
            </div>
            <div class="qty-control">
              <button type="button" class="qty-btn" data-action="minus" aria-label="Diminuir">−</button>
              <input type="number" class="qty-input"
                data-produto-id="${p.id}"
                data-categoria="${cat.nome}"
                data-nome="${p.nome}"
                data-ref="${p.ref}"
                data-unidade="${p.unidade}"
                value="0" min="0" max="9999"
                aria-label="Quantidade de ${p.nome}">
              <button type="button" class="qty-btn" data-action="plus" aria-label="Aumentar">+</button>
            </div>
          </div>`).join('')}
      </div>`;
    container.appendChild(el);
  });

  setupAccordion();
  setupQtySteppers();
  setupQtySummary();
}

// ─── Accordion ────────────────────────────────────────────────────────────
function setupAccordion() {
  document.querySelectorAll('.categoria-header').forEach(header => {
    header.addEventListener('click', () => {
      const body  = header.nextElementSibling;
      const aberto = !header.classList.contains('collapsed');
      header.classList.toggle('collapsed', aberto);
      body.style.maxHeight = aberto ? '0' : body.scrollHeight + 'px';
      body.style.overflow  = aberto ? 'hidden' : 'visible';
    });
  });
}

// ─── Qty steppers ─────────────────────────────────────────────────────────
function setupQtySteppers() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const input = btn.closest('.qty-control').querySelector('.qty-input');
    if (!input) return;
    let v = parseInt(input.value, 10) || 0;
    v = btn.dataset.action === 'plus' ? v + 1 : Math.max(0, v - 1);
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// ─── Contador de unidades ─────────────────────────────────────────────────
function setupQtySummary() {
  const summaryEl = document.getElementById('orderSummaryCount');
  document.addEventListener('input', e => {
    if (!e.target.classList.contains('qty-input')) return;
    let total = 0;
    document.querySelectorAll('.qty-input').forEach(inp => {
      const v = parseInt(inp.value, 10) || 0;
      inp.classList.toggle('has-value', v > 0);
      total += v;
    });
    if (summaryEl) summaryEl.textContent = total;
  });
}

// ─── Submit ───────────────────────────────────────────────────────────────
function mostrarSucesso(enc) {
  document.getElementById('estado-form').style.display    = 'none';
  document.getElementById('estado-sucesso').style.display = 'block';
  document.getElementById('btn-pdf-sucesso').addEventListener('click', () => gerarPDF(enc));
}

function mostrarErro(msg) {
  const el = document.getElementById('form-erro');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

async function onReady(user, userData) {
  // Título da marca
  document.getElementById('marca-badge').style.background = marca.cor;
  document.getElementById('marca-badge').innerHTML = `<i class="fas ${marca.icon} me-2"></i>${marca.nome}`;
  document.getElementById('marca-titulo').textContent = `Nova Encomenda — ${marca.nome}`;
  document.title = `Nova Encomenda ${marca.nome}`;

  buildForm();

  document.getElementById('formEncomenda').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>A guardar…'; }

    const itens = [];
    let totalQty = 0;
    document.querySelectorAll('.qty-input').forEach(inp => {
      const qty = parseInt(inp.value, 10) || 0;
      if (qty > 0) {
        itens.push({
          produtoId:  inp.dataset.produtoId,
          nome:       inp.dataset.nome,
          referencia: inp.dataset.ref,
          unidade:    inp.dataset.unidade,
          categoria:  inp.dataset.categoria,
          quantidade: qty,
        });
        totalQty += qty;
      }
    });

    if (totalQty === 0) {
      mostrarErro('Adicione pelo menos um produto com quantidade maior que zero.');
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane me-1"></i>Enviar Encomenda`; }
      return;
    }

    try {
      const numero  = await gerarNumero();
      const payload = {
        numero,
        userId:          user.uid,
        userNome:        userData.nome ?? user.email,
        marcaSlug,
        marcaNome:       marca.nome,
        marcaCor:        marca.cor,
        estado:          'enviada',
        observacoes:     document.getElementById('observacoes').value.trim(),
        itens,
        totalQuantidade: totalQty,
        createdAt:       serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'encomendas'), payload);
      mostrarSucesso({ id: ref.id, ...payload, createdAt: { toDate: () => new Date() } });
    } catch (err) {
      console.error(err);
      mostrarErro('Erro ao guardar a encomenda. Tente novamente.');
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane me-1"></i>Enviar Encomenda`; }
    }
  });
}

initPage({ pagina: marcaSlug, titulo: `Nova Encomenda — ${marca?.nome ?? ''}`, onReady });
