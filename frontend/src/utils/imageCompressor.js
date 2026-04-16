/**
 * Utilitário para compressão de imagens
 * Reduz o tamanho das imagens antes do upload mantendo qualidade aceitável
 */

// Configurações de compressão
const DEFAULT_OPTIONS = {
  maxWidth: 1200,      // Largura máxima em pixels
  maxHeight: 1200,     // Altura máxima em pixels
  quality: 0.7,        // Qualidade JPEG (0-1)
  mimeType: 'image/jpeg'
};

/**
 * Comprime uma imagem a partir de um File ou Blob
 * @param {File|Blob} file - Arquivo de imagem original
 * @param {Object} options - Opções de compressão
 * @returns {Promise<string>} - Data URL da imagem comprimida
 */
export const compressImage = (file, options = {}) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    // Verificar se é uma imagem
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo não é uma imagem válida'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        try {
          const compressedDataUrl = resizeAndCompress(img, settings);
          resolve(compressedDataUrl);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Erro ao carregar a imagem'));
      };

      img.src = event.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Redimensiona e comprime a imagem usando Canvas
 * @param {HTMLImageElement} img - Elemento de imagem
 * @param {Object} settings - Configurações
 * @returns {string} - Data URL comprimido
 */
function resizeAndCompress(img, settings) {
  const { maxWidth, maxHeight, quality, mimeType } = settings;

  let { width, height } = img;

  // Calcular novas dimensões mantendo proporção
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Criar canvas para compressão
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  // Configurar qualidade de renderização
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Desenhar imagem redimensionada
  ctx.drawImage(img, 0, 0, width, height);

  // Converter para data URL com compressão
  return canvas.toDataURL(mimeType, quality);
}

/**
 * Comprime imagem a partir de data URL
 * @param {string} dataUrl - Data URL da imagem original
 * @param {Object} options - Opções de compressão
 * @returns {Promise<string>} - Data URL comprimido
 */
export const compressDataUrl = (dataUrl, options = {}) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const compressedDataUrl = resizeAndCompress(img, settings);
        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Erro ao carregar a imagem'));
    };

    img.src = dataUrl;
  });
};

/**
 * Calcula o tamanho aproximado de um data URL em bytes
 * @param {string} dataUrl - Data URL
 * @returns {number} - Tamanho em bytes
 */
export const getDataUrlSize = (dataUrl) => {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round((base64.length * 3) / 4);
};

/**
 * Formata tamanho em bytes para exibição
 * @param {number} bytes - Tamanho em bytes
 * @returns {string} - Tamanho formatado
 */
export const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Por foto: acima disto comprime antes do PUT (fotos já comprimidas no item costumam ficar ~150–320 KB). */
const ROOM_PHOTO_DATA_URL_COMPRESS_THRESHOLD = 180 * 1024;
/**
 * Soma de todas as data URLs do checklist — muitas NC com fotos «pequenas» somavam MB sem disparar o limite por foto.
 * Segunda passagem evita timeout/rede e aproxima-se do limite de documento no MongoDB (~16 MB).
 */
const ROOM_CHECKLIST_PHOTOS_TOTAL_SOFT_CAP = 5.5 * 1024 * 1024;

const SAVE_COMPRESS_PASS1 = {
  maxWidth: 960,
  maxHeight: 960,
  quality: 0.58,
  mimeType: 'image/jpeg',
};

const SAVE_COMPRESS_PASS2 = {
  maxWidth: 768,
  maxHeight: 768,
  quality: 0.5,
  mimeType: 'image/jpeg',
};

function sumDataImageBytesInRooms(rooms) {
  let total = 0;
  for (const room of rooms || []) {
    for (const item of room.items || []) {
      for (const p of item.photos || []) {
        const url = p?.url;
        if (typeof url === 'string' && url.startsWith('data:image')) {
          total += getDataUrlSize(url);
        }
      }
    }
  }
  return total;
}

/**
 * @param {unknown[]} rooms
 * @param {(url: string) => boolean} shouldCompress
 * @param {object} settings
 */
async function compressRoomPhotoDataUrls(rooms, shouldCompress, settings) {
  for (const room of rooms) {
    const items = room.items || [];
    for (const item of items) {
      const photos = item.photos || [];
      for (let i = 0; i < photos.length; i++) {
        const url = photos[i]?.url;
        if (typeof url !== 'string' || !url.startsWith('data:image')) continue;
        if (!shouldCompress(url)) continue;
        try {
          photos[i] = { ...photos[i], url: await compressDataUrl(url, settings) };
        } catch (e) {
          console.warn('[compressRooms] foto não comprimida:', e);
        }
      }
    }
  }
}

/**
 * Reduz data URLs grandes em `rooms_checklist` para o PUT não falhar por tempo/tamanho.
 * @param {unknown[]} roomsChecklist
 * @returns {Promise<unknown[]>}
 */
export async function compressRoomsChecklistPhotosIfNeeded(roomsChecklist, options = {}) {
  const pass1Settings = { ...SAVE_COMPRESS_PASS1, ...options };
  let rooms;
  try {
    rooms = JSON.parse(JSON.stringify(roomsChecklist || []));
  } catch {
    return roomsChecklist || [];
  }

  await compressRoomPhotoDataUrls(
    rooms,
    (url) => getDataUrlSize(url) > ROOM_PHOTO_DATA_URL_COMPRESS_THRESHOLD,
    pass1Settings
  );

  if (sumDataImageBytesInRooms(rooms) > ROOM_CHECKLIST_PHOTOS_TOTAL_SOFT_CAP) {
    await compressRoomPhotoDataUrls(
      rooms,
      (url) => getDataUrlSize(url) > 65 * 1024,
      SAVE_COMPRESS_PASS2
    );
  }

  return rooms;
}

export default compressImage;
