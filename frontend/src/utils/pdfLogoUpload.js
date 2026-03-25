/**
 * Redimensiona PNG/JPEG para o PDF (lado máx. 480px), fundo branco, saída JPEG.
 * Limita tamanho da string para não inflar o documento na API/Mongo.
 */
const MAX_SIDE_PX = 480;
const MAX_DATA_URL_CHARS = 1_800_000;

export async function prepareLogoDataUrlForPdf(file) {
  if (!file || !file.type) {
    throw new Error('Ficheiro inválido.');
  }
  const t = file.type.toLowerCase();
  if (t !== 'image/png' && t !== 'image/jpeg' && t !== 'image/jpg') {
    throw new Error('Use imagem PNG ou JPEG.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
        const w0 = img.naturalWidth;
        const h0 = img.naturalHeight;
        if (!w0 || !h0) {
          reject(new Error('Não foi possível ler as dimensões da imagem.'));
          return;
        }
        const scale = Math.min(1, MAX_SIDE_PX / Math.max(w0, h0));
        const cw = Math.max(1, Math.round(w0 * scale));
        const ch = Math.max(1, Math.round(h0 * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas não disponível.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        if (dataUrl.length > MAX_DATA_URL_CHARS) {
          reject(new Error('Imagem ainda grande. Tente outro ficheiro.'));
          return;
        }
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível carregar a imagem.'));
    };
    img.src = objectUrl;
  });
}
