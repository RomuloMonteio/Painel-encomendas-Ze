function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function formatarData(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ucfirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

export function gerarPDF(encomenda) {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF('p', 'mm', 'a4');
  const [r, g, b] = hexToRgb(encomenda.marcaCor || '#003087');

  // ─── Cabeçalho colorido ───────────────────────────────────────────────
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`Encomenda ${encomenda.numero}`, 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${encomenda.marcaNome}  ·  ${formatarData(encomenda.createdAt)}`, 14, 28);

  // ─── Meta ─────────────────────────────────────────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.autoTable({
    startY: 44,
    body: [
      ['Número', encomenda.numero,         'Data',       formatarData(encomenda.createdAt)],
      ['Marca',  encomenda.marcaNome,       'Utilizador', encomenda.userNome ?? '—'],
      ['Estado', ucfirst(encomenda.estado), 'Total Unid.',String(encomenda.totalQuantidade)],
    ],
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [100, 116, 139] },
      1: { cellWidth: 64 },
      2: { cellWidth: 28, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [100, 116, 139] },
      3: { cellWidth: 64 },
    },
    styles: { fontSize: 9, cellPadding: 4 },
    theme: 'grid',
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.3,
  });

  // ─── Itens agrupados por categoria ────────────────────────────────────
  const porCat = {};
  (encomenda.itens || []).forEach(item => {
    const cat = item.categoria ?? 'Outros';
    if (!porCat[cat]) porCat[cat] = [];
    porCat[cat].push(item);
  });

  Object.entries(porCat).forEach(([catNome, itens]) => {
    const y = doc.lastAutoTable.finalY + 8;

    // Título da secção
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, 'F');
    doc.setFillColor(r, g, b);
    doc.rect(14, y, 3, 7, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(catNome, 20, y + 5);

    doc.autoTable({
      startY: y + 7,
      head: [['Produto', 'Referência', 'Unidade', 'Quantidade']],
      body: itens.map(i => [i.nome, i.referencia ?? '—', i.unidade ?? '—', i.quantidade]),
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [100, 116, 139],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 88 },
        1: { cellWidth: 36 },
        2: { cellWidth: 30 },
        3: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [r, g, b] },
      },
      styles: { fontSize: 9, cellPadding: 4, textColor: [30, 41, 59] },
      theme: 'grid',
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.3,
    });
  });

  // ─── Observações ──────────────────────────────────────────────────────
  if (encomenda.observacoes) {
    const y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Observações:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(encomenda.observacoes, 14, y + 6, { maxWidth: 182 });
  }

  // ─── Rodapé ───────────────────────────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-PT')} — Sistema de Gestão de Encomendas`,
      105, 288, { align: 'center' }
    );
  }

  doc.save(`encomenda-${encomenda.numero}.pdf`);
}
