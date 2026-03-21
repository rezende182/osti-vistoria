import React from 'react';
import { Check, Plus, X } from 'lucide-react';

const RoomSelector = ({
  rooms,
  selectedRoomId,
  onSelectRoom,
  roomsProgress,
  onAddRoom,
  onDeleteRoom,
  /** Quando false, o botão “Adicionar” fica desabilitado (ex.: checklist incompleto). */
  canAddRoom = true,
}) => {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-slate-200 py-3 px-4">
      <div className="flex gap-2 overflow-x-auto room-selector-scroll pb-2">
        {rooms.map((room) => {
          const isSelected = selectedRoomId === room.id;
          const progress = roomsProgress[room.id] || 0;
          const isComplete = progress === 100;

          return (
            <div key={room.id} className="flex-shrink-0 relative group">
              <button
                data-testid={`room-tab-${room.id}`}
                onClick={() => onSelectRoom(room.id)}
                className={`px-4 py-2 rounded-lg font-bold text-sm font-secondary uppercase transition-all duration-200 relative ${
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{room.name}</span>
                  {isComplete && (
                    <Check size={16} className="text-green-500" />
                  )}
                </div>
                {progress > 0 && progress < 100 && (
                  <div className="absolute bottom-0 left-0 h-1 bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                )}
              </button>
              {/* Botão de excluir cômodo */}
              {onDeleteRoom && (
                <button
                  data-testid={`delete-room-${room.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRoom(room.id);
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
        
        {/* Botão para adicionar cômodo - sempre visível */}
        {onAddRoom && (
          <button
            type="button"
            data-testid="add-room-button"
            disabled={!canAddRoom && rooms.length > 0}
            title={
              !canAddRoom && rooms.length > 0
                ? 'Preencha Existência e Condição em todos os itens antes de adicionar outro cômodo'
                : undefined
            }
            onClick={onAddRoom}
            className={`flex-shrink-0 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-200 flex items-center gap-2 ${
              !canAddRoom && rooms.length > 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : rooms.length === 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700 animate-pulse-slow'
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            }`}
          >
            <Plus size={16} />
            Adicionar
          </button>
        )}
      </div>
    </div>
  );
};

export default RoomSelector;
