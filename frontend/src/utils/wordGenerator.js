function text(v) {
  if (v == null) return '';
  return String(v).trim();
}

function escHtml(v) {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function br(v) {
  return escHtml(String(v || '')).replace(/\r?\n/g, '<br/>');
}

function formatDate(iso) {
  const s = text(iso);
  if (!s) return '-';
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return s;
}

function checklistHtml(inspection) {
  const rooms = inspection.rooms_checklist || [];
  const blocks = [];
  rooms.forEach((room) => {
    const roomName = text(room?.room_name) || 'Ambiente';
    const items = (room?.items || []).filter(
      (item) => item && text(item.name).toLowerCase() !== 'vidro'
    );
    if (!items.length) return;
    const itemsHtml = items
      .map((item) => {
        const photos = (item.photos || []).length;
        return `<li>${escHtml(text(item.name) || 'Item')} ${
          photos > 0 ? `(Não conformidades: ${photos})` : ''
        }</li>`;
      })
      .join('');
    blocks.push(`<h3>${escHtml(roomName)}</h3><ul>${itemsHtml}</ul>`);
  });
  return blocks.join('');
}

export function generateInspectionWord(inspection) {
  if (!inspection) throw new Error('Dados da vistoria não disponíveis');

  const clienteName = (inspection.cliente || 'Relatorio')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_');
  const dataArquivo = inspection.data_final || inspection.data;
  const dataFormatada = formatDate(dataArquivo).replace(/\//g, '-');
  const fileName = `Vistoria_${clienteName}_${dataFormatada}.doc`;

  const title = text(inspection.laudo_capa_titulo) || 'LAUDO DE VISTORIA';
  const subtitle = text(inspection.laudo_capa_subtitulo) || 'RECEBIMENTO DE IMÓVEL NOVO';
  const subject =
    text(inspection.laudo_capa_assunto) || 'Vistoria Técnica - Recebimento de imóvel novo';
  const city = text(inspection.cidade);
  const uf = text(inspection.uf);
  const cityUf = city && uf ? `${city.toUpperCase()} - ${uf.toUpperCase()}` : city || uf || '';
  const dt = formatDate(inspection.data_final || inspection.data);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; }
    .page { width: 170mm; margin: 20mm auto; }
    .cover { min-height: 245mm; display: flex; flex-direction: column; }
    .cover h1 { margin: 0; text-align: center; font-size: 24pt; text-transform: uppercase; letter-spacing: .4px; }
    .cover h2 { margin: 6mm 0 0; text-align: center; font-size: 15pt; font-weight: 400; text-transform: uppercase; }
    .cover-fields { margin-top: 18mm; }
    .cover-fields p { margin: 0 0 6mm; font-size: 14pt; }
    .cover-footer { margin-top: auto; text-align: center; font-size: 14pt; }
    h2 { margin: 0 0 5mm; font-size: 14pt; text-transform: uppercase; }
    h3 { margin: 4mm 0 2mm; font-size: 12pt; text-transform: uppercase; }
    p { margin: 0 0 2.5mm; }
    ul { margin: 0 0 3mm 6mm; }
    .break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="page cover">
    <h1>${escHtml(title)}</h1>
    <h2>${escHtml(subtitle)}</h2>
    <div class="cover-fields">
      <p><strong>Assunto:</strong> ${escHtml(subject)}</p>
      <p><strong>Contratante:</strong> ${escHtml(text(inspection.cliente) || '-')}</p>
      <p><strong>Endereço:</strong> ${escHtml(text(inspection.endereco) || '-')}</p>
      <p><strong>Responsável Técnico:</strong> ${escHtml(text(inspection.responsavel_tecnico) || '-')}</p>
    </div>
    <div class="cover-footer">
      ${cityUf ? `<p>${escHtml(cityUf)}</p>` : ''}
      ${dt ? `<p>${escHtml(dt)}</p>` : ''}
    </div>
  </div>

  <div class="page break">
    <h2>1. Identificação da Vistoria Técnica</h2>
    <p><strong>Data da vistoria:</strong> ${escHtml(formatDate(inspection.data))}</p>
    <p><strong>Horário do início:</strong> ${escHtml(text(inspection.horario_inicio) || '-')}</p>
    <p><strong>Horário do término:</strong> ${escHtml(text(inspection.horario_termino) || '-')}</p>

    <h2>2. Verificação dos Ambientes</h2>
    ${checklistHtml(inspection) || '<p>Sem registros de ambientes.</p>'}

    ${
      text(inspection.conclusao)
        ? `<h2>3. Conclusão</h2><p>${br(inspection.conclusao)}</p>`
        : ''
    }
  </div>
</body>
</html>`;

  const blob = new Blob([html], {
    type: 'application/msword;charset=utf-8',
  });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 100);

  return true;
}

export default generateInspectionWord;
