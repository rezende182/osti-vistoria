import React, { useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { RotateCcw } from 'lucide-react';

const SignaturePad = ({ onChange }) => {
  const sigPad = useRef(null);

  const clear = () => {
    if (sigPad.current) {
      sigPad.current.clear();
      onChange('');
    }
  };

  const handleEnd = () => {
    if (sigPad.current) {
      const dataURL = sigPad.current.toDataURL();
      onChange(dataURL);
    }
  };

  return (
    <div>
      <div className="signature-canvas bg-white">
        <SignatureCanvas
          ref={sigPad}
          canvasProps={{
            width: 500,
            height: 200,
            className: 'w-full h-[200px]'
          }}
          onEnd={handleEnd}
        />
      </div>
      <button
        data-testid="clear-signature-button"
        onClick={clear}
        className="mt-2 flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-slate-200"
      >
        <RotateCcw size={16} />
        Limpar assinatura
      </button>
    </div>
  );
};

export default SignaturePad;