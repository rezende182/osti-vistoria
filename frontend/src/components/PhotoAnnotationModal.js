import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Undo2, Trash2, MousePointer2, Pencil } from 'lucide-react';

const COLORS = [
  { id: 'red', label: 'Vermelho', hex: '#dc2626' },
  { id: 'yellow', label: 'Amarelo', hex: '#eab308' },
  { id: 'blue', label: 'Azul', hex: '#2563eb' },
];

const DISPLAY_LINE = 3.5;

function drawArrowOnCtx(ctx, x1, y1, x2, y2, color, lineWidth) {
  const headLen = Math.max(14, lineWidth * 4);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 7),
    y2 - headLen * Math.sin(angle - Math.PI / 7)
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 7),
    y2 - headLen * Math.sin(angle + Math.PI / 7)
  );
  ctx.closePath();
  ctx.fill();
}

function drawStrokeScaled(ctx, stroke, sx, sy) {
  const lw = ((stroke.lineWidth || DISPLAY_LINE) * (sx + sy)) / 2;
  if (stroke.type === 'arrow') {
    drawArrowOnCtx(
      ctx,
      stroke.x1 * sx,
      stroke.y1 * sy,
      stroke.x2 * sx,
      stroke.y2 * sy,
      stroke.color,
      lw
    );
  } else if (stroke.type === 'freehand' && stroke.points?.length) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.points[0][0] * sx, stroke.points[0][1] * sy);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i][0] * sx, stroke.points[i][1] * sy);
    }
    ctx.stroke();
  }
}

function drawStrokeDisplay(ctx, stroke) {
  drawStrokeScaled(ctx, stroke, 1, 1);
}

function getLogicalPoint(canvas, clientX, clientY, dpr) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / dpr / rect.width;
  const scaleY = canvas.height / dpr / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  return { x, y };
}

/**
 * Modal em ecrã inteiro: foto em tamanho útil + desenho livre ou setas (cores laudo).
 */
export default function PhotoAnnotationModal({ imageUrl, onClose, onApply }) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const displayDimsRef = useRef({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [color, setColor] = useState(COLORS[0].hex);
  const [tool, setTool] = useState('arrow');
  const [strokes, setStrokes] = useState([]);
  const draftRef = useRef(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const dprRef = useRef(typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1);

  const paintCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = dprRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    strokesRef.current.forEach((s) => drawStrokeDisplay(ctx, s));
    const draft = draftRef.current;
    if (draft) {
      if (draft.type === 'arrow' && draft.from && draft.to) {
        drawArrowOnCtx(
          ctx,
          draft.from.x,
          draft.from.y,
          draft.to.x,
          draft.to.y,
          draft.color,
          DISPLAY_LINE
        );
      } else if (draft.type === 'freehand' && draft.points?.length) {
        drawStrokeDisplay(ctx, {
          type: 'freehand',
          color: draft.color,
          points: draft.points,
          lineWidth: DISPLAY_LINE,
        });
      }
    }
  }, []);

  useEffect(() => {
    paintCanvas();
  }, [strokes, paintCanvas]);

  const layoutCanvas = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !naturalSize.w) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    if (w < 2 || h < 2) return;
    const dpr = dprRef.current;
    displayDimsRef.current = { w, h };
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    requestAnimationFrame(() => paintCanvas());
  }, [naturalSize.w, paintCanvas]);

  useEffect(() => {
    const el = wrapRef.current;
    let ro;
    if (typeof ResizeObserver !== 'undefined' && el) {
      ro = new ResizeObserver(() => layoutCanvas());
      ro.observe(el);
    }
    window.addEventListener('resize', layoutCanvas);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', layoutCanvas);
    };
  }, [layoutCanvas, imageUrl]);

  const handleImgLoad = (e) => {
    const im = e.target;
    setNaturalSize({ w: im.naturalWidth, h: im.naturalHeight });
    requestAnimationFrame(() => layoutCanvas());
  };

  const pushStroke = (stroke) => {
    draftRef.current = null;
    setStrokes((prev) => [...prev, stroke]);
  };

  const onPointerDown = (e) => {
    if (!canvasRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const dpr = dprRef.current;
    const { x, y } = getLogicalPoint(canvasRef.current, e.clientX, e.clientY, dpr);
    if (tool === 'arrow') {
      draftRef.current = { type: 'arrow', from: { x, y }, to: { x, y }, color };
    } else {
      draftRef.current = { type: 'freehand', color, points: [[x, y]] };
    }
    paintCanvas();
  };

  const onPointerMove = (e) => {
    const draft = draftRef.current;
    if (!draft || !canvasRef.current) return;
    const dpr = dprRef.current;
    const { x, y } = getLogicalPoint(canvasRef.current, e.clientX, e.clientY, dpr);
    if (draft.type === 'arrow') {
      draft.to = { x, y };
    } else if (draft.type === 'freehand') {
      draft.points.push([x, y]);
    }
    paintCanvas();
  };

  const onPointerUp = (e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const draft = draftRef.current;
    if (!draft) return;
    if (draft.type === 'arrow' && draft.from && draft.to) {
      const dx = draft.to.x - draft.from.x;
      const dy = draft.to.y - draft.from.y;
      if (Math.hypot(dx, dy) > 8) {
        pushStroke({
          type: 'arrow',
          x1: draft.from.x,
          y1: draft.from.y,
          x2: draft.to.x,
          y2: draft.to.y,
          color: draft.color,
          lineWidth: DISPLAY_LINE,
        });
      } else {
        draftRef.current = null;
        paintCanvas();
      }
    } else if (draft.type === 'freehand' && draft.points?.length > 1) {
      pushStroke({
        type: 'freehand',
        points: draft.points,
        color: draft.color,
        lineWidth: DISPLAY_LINE,
      });
    } else {
      draftRef.current = null;
      paintCanvas();
    }
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
    draftRef.current = null;
  };

  const handleClear = () => {
    setStrokes([]);
    draftRef.current = null;
  };

  const handleApply = () => {
    const img = imgRef.current;
    if (!img || !naturalSize.w) {
      onClose();
      return;
    }
    const nw = naturalSize.w;
    const nh = naturalSize.h;
    const dw = displayDimsRef.current.w || img.clientWidth;
    const dh = displayDimsRef.current.h || img.clientHeight;
    if (!dw || !dh) {
      onClose();
      return;
    }
    const sx = nw / dw;
    const sy = nh / dh;

    const out = document.createElement('canvas');
    out.width = nw;
    out.height = nh;
    const ctx = out.getContext('2d');
    if (!ctx) {
      onClose();
      return;
    }
    ctx.drawImage(img, 0, 0, nw, nh);
    strokesRef.current.forEach((s) => drawStrokeScaled(ctx, s, sx, sy));
    try {
      onApply(out.toDataURL('image/jpeg', 0.88));
    } catch (err) {
      console.error('Exportar foto anotada:', err);
      try {
        onApply(out.toDataURL('image/png'));
      } catch (e2) {
        console.error(e2);
      }
    }
    onClose();
  };

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-slate-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Marcar na foto"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold font-secondary uppercase tracking-wide text-white sm:text-base">
            Marcar na foto
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
            Seta ou traço livre — vermelho, amarelo ou azul para o laudo
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 sm:text-sm"
        >
          <X size={18} aria-hidden />
          Fechar
        </button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2 sm:gap-3 sm:px-4">
        <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:w-auto">
          Cor
        </span>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              onClick={() => setColor(c.hex)}
              className={`h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-slate-950 transition-transform ${
                color === c.hex ? 'scale-110 ring-white' : 'ring-transparent hover:ring-slate-500'
              }`}
              style={{ backgroundColor: c.hex }}
              aria-label={c.label}
            />
          ))}
        </div>
        <span className="ml-0 w-full text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:ml-2 sm:w-auto">
          Ferramenta
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTool('arrow')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              tool === 'arrow' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MousePointer2 size={16} aria-hidden />
            Seta
          </button>
          <button
            type="button"
            onClick={() => setTool('freehand')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              tool === 'freehand' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Pencil size={16} aria-hidden />
            Livre
          </button>
        </div>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40 sm:px-3 sm:text-sm"
          >
            <Undo2 size={16} aria-hidden />
            Desfazer
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40 sm:px-3 sm:text-sm"
          >
            <Trash2 size={16} aria-hidden />
            Limpar
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-6">
        <div
          ref={wrapRef}
          className="relative inline-block max-h-[min(72vh,820px)] max-w-full"
          style={{ touchAction: 'none' }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            onLoad={handleImgLoad}
            className="max-h-[min(72vh,820px)] max-w-[min(100vw-1.5rem,920px)] object-contain select-none"
            draggable={false}
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-auto absolute left-0 top-0 cursor-crosshair touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </div>

      <footer className="flex shrink-0 gap-2 border-t border-slate-800 bg-slate-900/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={onClose}
          className="min-h-touch flex-1 rounded-xl border border-slate-600 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 sm:min-h-0 sm:flex-none sm:px-6"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="min-h-touch flex-1 rounded-xl bg-sky-600 py-3 text-sm font-bold font-secondary uppercase tracking-wide text-white transition-colors hover:bg-sky-500 sm:min-h-0 sm:flex-none sm:px-8"
        >
          Aplicar à foto
        </button>
      </footer>
    </div>
  );

  return createPortal(modal, document.body);
}
