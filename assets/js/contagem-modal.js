import { gerarPDFContagem, partilharWhatsApp } from './pdf.js';

// ─── Modal de detalhe de uma contagem — partilhado entre histórico e calendário ──
export function abrirModalContagem(cnt, { onApagar } = {}) {
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

  if (cnt.updatedAt) {
    const du = cnt.updatedAt.toDate ? cnt.updatedAt.toDate() : new Date(cnt.updatedAt);
    html += `
      <div style="background:#f3e8ff;border:1px solid #e9d5ff;border-radius:8px;padding:.6rem 1rem;margin-top:.5rem;font-size:.8rem;color:#7c3aed;">
        <i class="fas fa-pen me-1"></i>Editado por <strong>${cnt.updatedByNome ?? '—'}</strong>
        em ${du.toLocaleDateString('pt-PT')} às ${du.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
      </div>`;
  }

  if (!html) {
    html = `<p class="text-muted text-center py-3">Sem dados para mostrar.</p>`;
  }

  document.getElementById('modal-body').innerHTML = html;

  document.getElementById('modal-btn-pdf').onclick      = () => gerarPDFContagem(cnt);
  document.getElementById('modal-btn-whatsapp').onclick  = () => partilharWhatsApp(cnt);
  document.getElementById('modal-btn-apagar').onclick    = () => onApagar?.(cnt);
  document.getElementById('modal-btn-editar').href       =
    `contagem.html?marca=${cnt.marcaSlug}&edit=${cnt.id}`;

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalContagem')).show();
}
