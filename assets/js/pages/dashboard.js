import { initPage }  from '../layout.js';
import { db }         from '../firebase.js';
import { AGENDA_SEMANAL, MARCAS } from '../data.js';
import { abrirModalContagem }     from '../contagem-modal.js';
import {
  collection, query, orderBy, limit, getDocs, where, Timestamp,
  doc, deleteDoc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function formatDt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-PT') + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

// Data local (não UTC) no formato YYYY-MM-DD, usada para associar manualmente
// uma contagem a um dia do calendário independentemente da hora de criação.
function dataISOLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let currentUser = null, currentUserData = null;
let todasContagensRecentes = [];

async function onReady(user, userData) {
  currentUser = user; currentUserData = userData;

  // Uma só query — tudo calculado no cliente, sem índices compostos
  const snap = await getDocs(query(
    collection(db, 'contagens'),
    orderBy('createdAt', 'desc'),
    limit(200)
  ));
  const contagens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  todasContagensRecentes = contagens;

  // ─── Stats ─────────────────────────────────────────────────────────────
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const mes  = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  let statHoje = 0, statMes = 0, statSB = 0, statSumol = 0;
  contagens.forEach(c => {
    const d = c.createdAt?.toDate ? c.createdAt.toDate() : null;
    if (!d) return;
    if (d >= hoje) statHoje++;
    if (d >= mes) {
      statMes++;
      if (c.marcaSlug === 'super-bock') statSB++;
      else statSumol++;
    }
  });

  document.getElementById('stat-hoje').textContent  = statHoje;
  document.getElementById('stat-mes').textContent   = statMes;
  document.getElementById('stat-sb').textContent    = statSB;
  document.getElementById('stat-sumol').textContent = statSumol;

  // ─── Gráfico — últimos 7 dias ──────────────────────────────────────────
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
  seteDiasAtras.setHours(0, 0, 0, 0);

  const porDia = {};
  contagens.forEach(c => {
    const d = c.createdAt?.toDate ? c.createdAt.toDate() : null;
    if (!d || d < seteDiasAtras) return;
    const dia = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    porDia[dia] = (porDia[dia] ?? 0) + 1;
  });

  const labels = [], totals = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const l = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    labels.push(l);
    totals.push(porDia[l] ?? 0);
  }

  const ctx = document.getElementById('chartSemanal');
  if (ctx && window.Chart) {
    new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Contagens',
          data: totals,
          backgroundColor: 'rgba(37,99,235,.15)',
          borderColor: '#2563eb',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.05)' } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } },
        },
      },
    });
  }

  // ─── Tabela últimas 5 ──────────────────────────────────────────────────
  const ultimas = contagens.slice(0, 5);
  const tbody   = document.getElementById('tbody-ultimas');

  if (!ultimas.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">
      <i class="fas fa-inbox me-2 opacity-50"></i>Sem contagens</td></tr>`;
  } else {
    tbody.innerHTML = ultimas.map(cnt => {
      const total    = cnt.itens?.length ?? 0;
      const aPedir   = cnt.itens?.filter(i => i.tipo === 'stock' && (i.aPedir ?? 0) > 0).length ?? 0;
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
        </tr>`;
    }).join('');
  }
}

// ─── Calendário de Listas ───────────────────────────────────────────────────
const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MES_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();
let contagensCache   = [];
let listasFaltaCache = [];

function inicioGrid(ano, mes) {
  const d = new Date(ano, mes, 1);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function fimGrid(ano, mes) {
  const d = new Date(ano, mes + 1, 0);
  d.setDate(d.getDate() + (6 - d.getDay()));
  d.setHours(23, 59, 59, 999);
  return d;
}

async function carregarContagensIntervalo(inicio, fim) {
  const snap = await getDocs(query(
    collection(db, 'contagens'),
    where('createdAt', '>=', Timestamp.fromDate(inicio)),
    where('createdAt', '<',  Timestamp.fromDate(fim)),
    orderBy('createdAt'),
  ));
  const porData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Cobre o caso de uma contagem associada manualmente a um dia deste grid,
  // mas cujo createdAt real cai fora do intervalo (ex: feita num mês anterior).
  const snapAssoc = await getDocs(query(
    collection(db, 'contagens'),
    where('calendarioData', '>=', dataISOLocal(inicio)),
    where('calendarioData', '<=', dataISOLocal(fim)),
    orderBy('calendarioData'),
  ));
  const porAssociacao = snapAssoc.docs.map(d => ({ id: d.id, ...d.data() }));

  const mapa = new Map();
  [...porData, ...porAssociacao].forEach(c => mapa.set(c.id, c));
  return [...mapa.values()];
}

async function carregarListasFalta() {
  const snap = await getDocs(query(collection(db, 'listasFalta'), orderBy('dataLimite', 'desc'), limit(60)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Janela de verificação de uma tarefa para uma data-célula específica do calendário
function calcularJanela(tarefa, dataCelula) {
  const fim = new Date(dataCelula); fim.setHours(23, 59, 59, 999);
  const inicio = new Date(dataCelula); inicio.setHours(0, 0, 0, 0);
  if (tarefa.diaInicioJanela != null) {
    const diasAntes = (tarefa.diaSemana - tarefa.diaInicioJanela + 7) % 7;
    inicio.setDate(inicio.getDate() - diasAntes);
  }
  return { inicio, fim };
}

function estadoTarefaNoDia(tarefa, dataCelula) {
  const { inicio, fim } = calcularJanela(tarefa, dataCelula);
  const agora = new Date();
  let feita = false, registro = null;

  if (tarefa.tipo === 'contagem') {
    const dataISOCel = dataISOLocal(dataCelula);
    const candidatas = contagensCache.filter(c => {
      if (c.marcaSlug !== tarefa.marcaSlug) return false;
      if (c.calendarioData === dataISOCel) return true;
      const d = c.createdAt?.toDate ? c.createdAt.toDate() : null;
      return d && d >= inicio && d <= fim;
    });
    if (candidatas.length) { feita = true; registro = candidatas[candidatas.length - 1]; }
  } else if (tarefa.tipo === 'faltas') {
    const ciclo = listasFaltaCache.find(c => {
      const d = c.dataLimite?.toDate ? c.dataLimite.toDate() : null;
      return d && d >= inicio && d <= fim;
    });
    if (ciclo) { registro = ciclo; feita = ciclo.entregue === true; }
  }

  let cor;
  if (feita)              cor = 'verde';
  else if (agora > fim)    cor = 'vermelho';
  else if (agora >= inicio) cor = 'amarelo';
  else                      cor = 'cinza';

  return { cor, feita, registro };
}

async function carregarECalendario() {
  const grid = document.getElementById('calendario-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="text-center py-4 text-muted" style="grid-column:1/-1;">
    <i class="fas fa-spinner fa-spin me-2"></i>A carregar…</div>`;

  document.getElementById('cal-mes-label').textContent = `${MES_LABELS[mesAtual]} ${anoAtual}`;

  const inicio = inicioGrid(anoAtual, mesAtual);
  const fim    = fimGrid(anoAtual, mesAtual);

  [contagensCache, listasFaltaCache] = await Promise.all([
    carregarContagensIntervalo(inicio, fim),
    carregarListasFalta(),
  ]);

  renderCalendario(inicio, fim);
}

function renderCalendario(inicio, fim) {
  const grid = document.getElementById('calendario-grid');
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  let html = DOW_LABELS.map(l => `<div class="calendario-dow">${l}</div>`).join('');

  const cursor = new Date(inicio);
  while (cursor <= fim) {
    const noMes  = cursor.getMonth() === mesAtual;
    const isHoje = cursor.getTime() === hoje.getTime();
    const tarefasDoDia = noMes ? AGENDA_SEMANAL.filter(t => t.diaSemana === cursor.getDay()) : [];

    if (!noMes) {
      html += `<div class="calendario-dia vazio"></div>`;
    } else if (!tarefasDoDia.length) {
      html += `
        <div class="calendario-dia ${isHoje ? 'hoje' : ''}">
          <div class="calendario-dia-num">${cursor.getDate()}</div>
        </div>`;
    } else {
      const dots = tarefasDoDia.map(t => {
        const { cor } = estadoTarefaNoDia(t, cursor);
        return `<span class="calendario-dot dot-${cor}"></span>`;
      }).join('');
      html += `
        <div class="calendario-dia com-tarefa ${isHoje ? 'hoje' : ''}" data-data="${cursor.toISOString()}">
          <div class="calendario-dia-num">${cursor.getDate()}</div>
          <div class="calendario-dots">${dots}</div>
        </div>`;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  grid.innerHTML = html;
  grid.querySelectorAll('[data-data]').forEach(el => {
    el.addEventListener('click', () => abrirModalDia(new Date(el.dataset.data)));
  });
}

async function associarContagemAoDia(contagemId, dataCelula) {
  try {
    await updateDoc(doc(db, 'contagens', contagemId), {
      calendarioData: dataISOLocal(dataCelula),
      calendarioAtribuidoPor: currentUser?.uid ?? null,
      calendarioAtribuidoPorNome: currentUserData?.nome ?? currentUser?.email ?? null,
    });
    await carregarECalendario();
    abrirModalDia(dataCelula);
  } catch (err) {
    console.error(err);
    alert('Erro ao associar a contagem. Tente novamente.');
  }
}

async function apagarContagemDashboard(cnt) {
  const d = cnt.createdAt?.toDate ? cnt.createdAt.toDate() : new Date();
  if (!confirm(`Apagar a contagem de ${cnt.marcaNome} de ${d.toLocaleDateString('pt-PT')}?\nEsta ação não pode ser desfeita.`)) return;
  try {
    await deleteDoc(doc(db, 'contagens', cnt.id));
    bootstrap.Modal.getInstance(document.getElementById('modalContagem'))?.hide();
    await carregarECalendario();
  } catch (err) {
    console.error(err);
    alert('Erro ao apagar. Tente novamente.');
  }
}

function abrirModalDia(data) {
  const tarefasDoDia = AGENDA_SEMANAL.filter(t => t.diaSemana === data.getDay());
  const dataStr = data.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' });
  document.getElementById('modal-dia-titulo').textContent = dataStr.charAt(0).toUpperCase() + dataStr.slice(1);

  const html = tarefasDoDia.map(t => {
    const { cor, feita, registro } = estadoTarefaNoDia(t, data);
    const nomeTarefa = t.tipo === 'faltas' ? 'Lista de Faltas' : (MARCAS[t.marcaSlug]?.nome ?? t.marcaSlug);

    let corpo;
    if (t.tipo === 'contagem') {
      if (feita && registro) {
        const editado = registro.updatedAt
          ? `<div class="text-muted" style="font-size:.78rem;margin-top:.2rem;"><i class="fas fa-pen me-1"></i>Editado por ${registro.updatedByNome ?? '—'}</div>`
          : '';
        corpo = `
          <div style="font-size:.85rem;">Feita por <strong>${registro.userNome ?? '—'}</strong></div>
          ${editado}
          <div class="d-flex gap-2 mt-2">
            <button type="button" class="btn-outline-custom py-1 px-2 btn-ver-contagem" style="font-size:.78rem;" data-registro-idx="${contagensCache.indexOf(registro)}">
              <i class="fas fa-eye me-1"></i>Pré-visualizar
            </button>
            <a href="contagem.html?marca=${t.marcaSlug}&edit=${registro.id}" class="btn-outline-custom py-1 px-2" style="font-size:.78rem;">
              <i class="fas fa-pen me-1"></i>Editar
            </a>
          </div>`;
      } else {
        const candidatas = todasContagensRecentes
          .filter(c => c.marcaSlug === t.marcaSlug)
          .slice(0, 15);
        const selectAssociar = candidatas.length ? `
          <div class="mt-2" style="font-size:.78rem;">
            <label class="text-muted d-block mb-1">Ou marcar como já feita, associando um registo existente:</label>
            <div class="d-flex gap-2">
              <select class="form-select form-select-sm select-associar-contagem" style="font-size:.78rem;">
                <option value="">Selecionar contagem…</option>
                ${candidatas.map(c => `<option value="${c.id}">${formatDt(c.createdAt)} — ${c.userNome ?? '—'}</option>`).join('')}
              </select>
              <button type="button" class="btn-outline-custom py-1 px-2 btn-associar-contagem" style="font-size:.78rem;" title="Associar">
                <i class="fas fa-check"></i>
              </button>
            </div>
          </div>` : '';
        corpo = `
          <div class="text-muted" style="font-size:.85rem;">Ainda não foi feita.</div>
          <a href="contagem.html?marca=${t.marcaSlug}" class="btn-outline-custom py-1 px-2 mt-2 d-inline-block" style="font-size:.78rem;">
            <i class="fas fa-plus me-1"></i>Fazer agora
          </a>
          ${selectAssociar}`;
      }
    } else {
      if (feita && registro) {
        corpo = `<div style="font-size:.85rem;">Entregue por <strong>${registro.entreguePorNome ?? '—'}</strong></div>`;
      } else {
        corpo = `
          <div class="text-muted" style="font-size:.85rem;">Ainda não foi entregue.</div>
          <a href="faltas.html" class="btn-outline-custom py-1 px-2 mt-2 d-inline-block" style="font-size:.78rem;">
            <i class="fas fa-cart-shopping me-1"></i>Abrir lista
          </a>`;
      }
    }

    return `
      <div class="tarefa-dia-item">
        <span class="tarefa-dia-dot dot-${cor}"></span>
        <div class="flex-fill">
          <strong style="font-size:.9rem;">${nomeTarefa}</strong>
          <div class="mt-1">${corpo}</div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('modal-dia-body').innerHTML =
    html || `<p class="text-muted text-center py-3">Sem listas agendadas para este dia.</p>`;

  document.getElementById('modal-dia-body').querySelectorAll('.btn-ver-contagem').forEach(btn => {
    btn.addEventListener('click', () => {
      const cnt = contagensCache[parseInt(btn.dataset.registroIdx, 10)];
      if (!cnt) return;
      bootstrap.Modal.getInstance(document.getElementById('modalDiaCalendario'))?.hide();
      abrirModalContagem(cnt, { onApagar: apagarContagemDashboard });
    });
  });

  document.getElementById('modal-dia-body').querySelectorAll('.btn-associar-contagem').forEach(btn => {
    btn.addEventListener('click', () => {
      const select = btn.previousElementSibling;
      if (!select || !select.value) { alert('Seleciona uma contagem para associar.'); return; }
      btn.disabled = true;
      associarContagemAoDia(select.value, data);
    });
  });

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDiaCalendario')).show();
}

function setupCalendario() {
  const grid = document.getElementById('calendario-grid');
  if (!grid) return;

  document.getElementById('cal-mes-anterior').addEventListener('click', () => {
    mesAtual--; if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
    carregarECalendario();
  });
  document.getElementById('cal-mes-seguinte').addEventListener('click', () => {
    mesAtual++; if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
    carregarECalendario();
  });

  carregarECalendario();
}

initPage({
  pagina: 'dashboard', titulo: 'Dashboard',
  onReady: async (...args) => { await onReady(...args); setupCalendario(); },
});
