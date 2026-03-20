import React from 'react';
import { Plus } from 'lucide-react';

const FAB = ({ onClick }) => {
  return (
    <button
      data-testid="fab-new-inspection"
      onClick={onClick}
      className="fixed bottom-20 right-6 bg-blue-600 text-white w-14 h-14 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex items-center justify-center transition-all duration-200 hover:bg-blue-700 hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] active:scale-95 z-50"
    >
      <Plus size={28} />
    </button>
  );
};

export default FAB;