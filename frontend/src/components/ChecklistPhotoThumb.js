import React, { useEffect, useState } from 'react';
import {
  fetchChecklistPhotoBlob,
  isGridFsChecklistPhotoUrl,
  parseGridFsFileId,
} from '../utils/checklistRemotePhotos';

/** Miniatura: data URL direto ou `gridfs:` com sessão. */
export default function ChecklistPhotoThumb({ url, inspectionId, getIdToken, alt = '', className = '' }) {
  const [src, setSrc] = useState(() =>
    url && !isGridFsChecklistPhotoUrl(url) ? url : null
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl;

    if (!url) {
      setSrc(null);
      return undefined;
    }
    if (!isGridFsChecklistPhotoUrl(url)) {
      setSrc(url);
      return undefined;
    }

    const fid = parseGridFsFileId(url);
    if (!fid || !inspectionId || typeof getIdToken !== 'function') {
      setSrc(null);
      return undefined;
    }

    (async () => {
      try {
        const blob = await fetchChecklistPhotoBlob(inspectionId, fid, getIdToken);
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, inspectionId, getIdToken]);

  if (!src) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-slate-200/90 text-[9px] text-slate-500 ${className}`}
        aria-hidden
      >
        …
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}
