import { initPage }  from '../layout.js';
import { db }         from '../firebase.js';
import {
  collection, query, orderBy, limit, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function formatDt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-PT') + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

async function onReady() {
  // Uma só query — tudo calculado no cliente, sem índices compostos
  const snap = await getDocs(query(
    collection(db, 'contagens'),
    orderBy('createdAt', 'desc'),
    limit(200)
  ));
  const contagens = snap.docs.map(d => ({ id: d.id, ...d.data() }));

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
        </tr>`;
    }).join('');
  }
}

initPage({ pagina: 'dashboard', titulo: 'Dashboard', onReady });
