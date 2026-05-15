import { initPage }  from '../layout.js';
import { db }         from '../firebase.js';
import { gerarPDF }   from '../pdf.js';
import {
  collection, query, where, orderBy, limit,
  getDocs, getCountFromServer, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

async function loadStats() {
  const encRef = collection(db, 'encomendas');
  const hoje   = new Date(); hoje.setHours(0, 0, 0, 0);
  const mes    = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [qHoje, qMes, qSB, qSumol, qPend] = await Promise.all([
    getCountFromServer(query(encRef, where('createdAt', '>=', Timestamp.fromDate(hoje)))),
    getCountFromServer(query(encRef, where('createdAt', '>=', Timestamp.fromDate(mes)))),
    getCountFromServer(query(encRef, where('marcaSlug', '==', 'super-bock'), where('createdAt', '>=', Timestamp.fromDate(mes)))),
    getCountFromServer(query(encRef, where('marcaSlug', '==', 'sumol'),      where('createdAt', '>=', Timestamp.fromDate(mes)))),
    getCountFromServer(query(encRef, where('estado', '==', 'enviada'))),
  ]);

  return {
    hoje:      qHoje.data().count,
    mes:       qMes.data().count,
    superBock: qSB.data().count,
    sumol:     qSumol.data().count,
    pendentes: qPend.data().count,
  };
}

async function loadChart7Dias() {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 6);
  inicio.setHours(0, 0, 0, 0);

  const snap = await getDocs(query(
    collection(db, 'encomendas'),
    where('createdAt', '>=', Timestamp.fromDate(inicio)),
    orderBy('createdAt')
  ));

  const porDia = {};
  snap.forEach(d => {
    const dia = d.data().createdAt.toDate().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    porDia[dia] = (porDia[dia] ?? 0) + 1;
  });

  const labels = [], totals = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const l = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    labels.push(l);
    totals.push(porDia[l] ?? 0);
  }
  return { labels, totals };
}

async function loadUltimas() {
  const snap = await getDocs(query(
    collection(db, 'encomendas'),
    orderBy('createdAt', 'desc'),
    limit(5)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function badgeEstado(estado) {
  const map = { enviada: 'badge-enviada', confirmada: 'badge-confirmada', entregue: 'badge-entregue', cancelada: 'badge-cancelada' };
  return `<span class="badge-estado ${map[estado] ?? ''}">${estado.charAt(0).toUpperCase() + estado.slice(1)}</span>`;
}

function formatDt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-PT') + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

async function onReady(_user, _userData) {
  const [stats, chart, ultimas] = await Promise.all([loadStats(), loadChart7Dias(), loadUltimas()]);

  // Stats
  document.getElementById('stat-hoje').textContent      = stats.hoje;
  document.getElementById('stat-mes').textContent       = stats.mes;
  document.getElementById('stat-sb').textContent        = stats.superBock;
  document.getElementById('stat-sumol').textContent     = stats.sumol;
  document.getElementById('stat-pendentes').textContent = stats.pendentes;

  if (stats.pendentes > 0) {
    document.getElementById('alert-pendentes').innerHTML = `
      <i class="fas fa-clock text-warning me-2"></i>
      <span style="font-size:.85rem;color:#92400e;">
        <strong>${stats.pendentes}</strong> encomenda(s) pendente(s)
      </span>
      <a href="historico.html?estado=enviada" class="ms-auto" style="font-size:.8rem;color:#d97706;">Ver</a>`;
    document.getElementById('alert-pendentes').style.display = 'flex';
  }

  // Gráfico
  const ctx = document.getElementById('chartSemanal');
  if (ctx && window.Chart) {
    new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: chart.labels,
        datasets: [{
          label: 'Encomendas',
          data: chart.totals,
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

  // Tabela últimas encomendas
  const tbody = document.getElementById('tbody-ultimas');
  if (!ultimas.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="fas fa-inbox me-2 opacity-50"></i>Sem encomendas</td></tr>`;
  } else {
    tbody.innerHTML = ultimas.map(enc => `
      <tr>
        <td><strong>${enc.numero}</strong></td>
        <td><span class="badge-estado ${enc.marcaSlug === 'super-bock' ? 'badge-sb' : 'badge-sumol'}">${enc.marcaNome}</span></td>
        <td>${enc.userNome ?? '—'}</td>
        <td>${enc.totalQuantidade ?? 0}</td>
        <td>${badgeEstado(enc.estado)}</td>
        <td>${formatDt(enc.createdAt)}</td>
        <td><button class="btn-outline-custom py-1 px-2" style="font-size:.78rem;color:#dc2626;border-color:#fca5a5;" data-pdf='${JSON.stringify(enc)}' title="PDF"><i class="fas fa-file-pdf"></i></button></td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-pdf]').forEach(btn =>
      btn.addEventListener('click', () => gerarPDF(JSON.parse(btn.dataset.pdf)))
    );
  }
}

initPage({ pagina: 'dashboard', titulo: 'Dashboard', onReady });
