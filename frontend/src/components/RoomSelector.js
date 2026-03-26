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
    <div className="sticky top-0 z-40 bg-white border-b border-slate-200 py-3 shadow-sm">
      <div className="mx-auto flex w-full max-w-app-readable gap-2 overflow-x-auto room-selector-scroll px-4 pb-2 sm:px-6 xl:max-w-app-wide [-webkit-overflow-scrolling:touch]">
        {rooms.map((room) => {
          const isSelected = selectedRoomId === room.id;
          const progress = roomsProgress[room.id] || 0;
          const isComplete = progress === 100;

          return (
            <div key={room.id} className="group relative flex-shrink-0">
              <button
                type="button"
                data-testid={`room-tab-${room.id}`}
                onClick={() => onSelectRoom(room.id)}
                className={`min-h-touch rounded-lg px-3 py-2.5 text-sm font-bold font-secondary uppercase transition-all duration-200 sm:min-h-0 sm:px-4 sm:py-2 ${
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
                } relative`}
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
                  type="button"
                  data-testid={`delete-room-${room.id}`}
                  aria-label={`Excluir ${room.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRoom(room.id);
                  }}
                  className="absolute -right-1 -top-1 hidden h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-opacity duration-200 hover:bg-red-600 fine:flex fine:opacity-0 fine:group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
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
                ? 'Preencha Condição ou observação em todos os itens antes de adicionar outro cômodo'
                : undefined
            }
            onClick={onAddRoom}
            className={`flex min-h-touch flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 sm:min-h-0 sm:py-2 ${
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
