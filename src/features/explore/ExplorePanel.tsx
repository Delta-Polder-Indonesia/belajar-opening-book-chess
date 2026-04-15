import React from 'react';
import { Search } from 'lucide-react';
import { Opening } from '../../types/chess';

type MoveRow = {
  number: number;
  white?: string;
  black?: string;
  whitePly: number;
  blackPly: number;
};

interface ExplorePanelProps {
  isLoading: boolean;
  loadError: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  openings: Opening[];
  selectedOpeningKey: string | null;
  onSelectOpening: (opening: Opening) => void;
  moveRows: MoveRow[];
  timelineIndex: number;
  onJumpToPly: (ply: number) => void;
}

const ExplorePanel: React.FC<ExplorePanelProps> = ({
  isLoading,
  loadError,
  search,
  onSearchChange,
  searchInputRef,
  openings,
  selectedOpeningKey,
  onSelectOpening,
  moveRows,
  timelineIndex,
  onJumpToPly,
}) => {
  if (isLoading) {
    return <p className="px-4 py-3 text-sm text-slate-300">Memuat opening book...</p>;
  }

  if (loadError) {
    return <p className="px-4 py-3 text-sm text-rose-300">{loadError}</p>;
  }

  return (
    <div className="space-y-3 px-3 py-3">
      <label className="relative block">
        <Search size={15} className="pointer-events-none absolute left-2 top-2.5 text-slate-400" />
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari ECO atau nama opening"
          className="w-full rounded-md border border-white/10 bg-[#2b2a27] py-2 pl-8 pr-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
        />
      </label>

      <ul className="max-h-60 space-y-1 overflow-y-auto border-b border-white/10 pb-2">
        {openings.map((opening) => {
          const key = `${opening.eco}-${opening.name}-${opening.moves}`;
          const isSelected = selectedOpeningKey === key;

          return (
            <li key={key}>
              <button
                onClick={() => onSelectOpening(opening)}
                className={`w-full rounded px-2 py-2 text-left text-sm transition ${
                  isSelected ? 'bg-[#5f8f3f] text-white' : 'text-slate-200 hover:bg-[#2b2a27]'
                }`}
              >
                <span className="block truncate font-medium">{opening.name}</span>
                <span className="text-xs text-slate-300/80">{opening.eco}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1 text-sm">
        {moveRows.length === 0 && <p className="text-slate-400">Pilih opening untuk lihat notasi.</p>}
        {moveRows.map((row) => (
          <div key={row.number} className="grid grid-cols-[28px_1fr_1fr] items-center gap-2 rounded px-1 py-0.5 hover:bg-white/5">
            <span className="text-xs text-slate-500">{row.number}.</span>
            <button
              onClick={() => onJumpToPly(row.whitePly)}
              className={`rounded px-1 py-0.5 text-left ${
                timelineIndex === row.whitePly ? 'bg-amber-300 text-slate-900' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              {row.white ?? '-'}
            </button>
            <button
              onClick={() => row.black && onJumpToPly(row.blackPly)}
              className={`rounded px-1 py-0.5 text-left ${
                timelineIndex === row.blackPly ? 'bg-amber-300 text-slate-900' : 'text-slate-200 hover:bg-white/10'
              }`}
              disabled={!row.black}
            >
              {row.black ?? ''}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExplorePanel;