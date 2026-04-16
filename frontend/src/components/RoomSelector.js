import React, { useState } from 'react';
import { Check, GripVertical, Plus, X } from 'lucide-react';

const RoomSelector = ({
  rooms,
  selectedRoomId,
  onSelectRoom,
  roomsProgress,
  onAddRoom,
  onDeleteRoom,
  /** (fromIndex, toIndex) — reordena abas dos ambientes por arrastar. */
  onReorderRooms,
  /** Quando false, o botão «Adicionar» fica desabilitado (ex.: checklist incompleto). */
  canAddRoom = true,
}) => {
  const [dragFromIndex, setDragFromIndex] = useState(null);

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white py-3 shadow-sm">
      <div className="room-selector-scroll mx-auto flex w-full max-w-app-readable gap-2 overflow-x-auto px-4 pb-2 sm:px-6 xl:max-w-app-wide [-webkit-overflow-scrolling:touch]">
        {rooms.map((room, index) => {
          const isSelected = selectedRoomId === room.id;
          const progress = roomsProgress[room.id] || 0;
          const isComplete = progress === 100;
          const isDragging = dragFromIndex === index;

          return (
            <div
              key={room.id}
              className="group relative flex-shrink-0"
              onDragOver={(e) => {
                if (!onReorderRooms) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                if (!onReorderRooms) return;
                e.preventDefault();
                const raw = e.dataTransfer.getData('text/plain');
                const from = parseInt(raw, 10);
                if (Number.isNaN(from) || from === index) {
                  setDragFromIndex(null);
                  return;
                }
                onReorderRooms(from, index);
                setDragFromIndex(null);
              }}
            >
              <button
                type="button"
                data-testid={`room-tab-${room.id}`}
                draggable={Boolean(onReorderRooms)}
                onDragStart={(e) => {
                  if (!onReorderRooms) return;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                  setDragFromIndex(index);
                }}
                onDragEnd={() => setDragFromIndex(null)}
                onClick={() => onSelectRoom(room.id)}
                style={isDragging ? { opacity: 0.55 } : undefined}
                className={`relative min-h-touch rounded-lg px-3 py-2.5 text-sm font-bold font-secondary uppercase transition-all duration-200 sm:min-h-0 sm:px-4 sm:py-2 ${
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
                } ${onReorderRooms ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {onReorderRooms && (
                    <GripVertical
                      size={14}
                      className={`shrink-0 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{room.name}</span>
                  {isComplete && <Check size={16} className="shrink-0 text-green-500" />}
                </div>
                {progress > 0 && progress < 100 && (
                  <div
                    className="absolute bottom-0 left-0 h-1 rounded-full bg-blue-500"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </button>
              {onDeleteRoom && (
                <button
                  type="button"
                  data-testid={`delete-room-${room.id}`}
                  aria-label={`Excluir ${room.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRoom(room.id);
                  }}
                  className="absolute -right-1 -top-1 z-10 hidden h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-opacity duration-200 hover:bg-red-600 fine:flex fine:opacity-0 fine:group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          );
        })}

        {onAddRoom && (
          <button
            type="button"
            data-testid="add-room-button"
            disabled={!canAddRoom && rooms.length > 0}
            title={
              !canAddRoom && rooms.length > 0
                ? 'Preencha observação ou foto em todos os elementos antes de adicionar outro ambiente'
                : undefined
            }
            onClick={onAddRoom}
            className={`flex min-h-touch flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 sm:min-h-0 sm:py-2 ${
              !canAddRoom && rooms.length > 0
                ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                : rooms.length === 0
                  ? 'animate-pulse-slow bg-blue-600 text-white hover:bg-blue-700'
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
