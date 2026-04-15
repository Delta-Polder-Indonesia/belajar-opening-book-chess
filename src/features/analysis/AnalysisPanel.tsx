import React from 'react';
import { BookOpen, Cpu, Ellipsis } from 'lucide-react';

type MoveRow = {
  number: number;
  white?: string;
  black?: string;
  whitePly: number;
  blackPly: number;
};

type SuggestionLine = {
  id: string;
  evalLabel: string;
  line: string;
};

interface AnalysisPanelProps {
  isLoading: boolean;
  loadError: string | null;
  engineReady: boolean;
  engineBusy: boolean;
  engineEval: string;
  engineBestMove: string;
  engineError: string | null;
  suggestionLines: SuggestionLine[];
  openingName: string;
  moveRows: MoveRow[];
  timelineIndex: number;
  onJumpToPly: (ply: number) => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  isLoading,
  loadError,
  engineReady,
  engineBusy,
  engineEval,
  engineBestMove,
  engineError,
  suggestionLines,
  openingName,
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
    <div className="space-y-0">
      <div className="border-b border-white/10 px-4 py-2">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Analysis
          </span>
          <span>depth=12</span>
        </div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Cpu size={14} />
          Stockfish WASM Lite
        </div>
        <p className="text-xs text-slate-400">
          {engineError
            ? engineError
            : !engineReady
              ? 'Menyiapkan engine...'
              : engineBusy
                ? 'Engine menganalisa posisi...'
                : 'Engine siap.'}
        </p>
        <div className="mt-2 space-y-1 text-xs text-slate-300">
          <p>Eval: {engineEval || '-'}</p>
          <p>Best move: {engineBestMove || '-'}</p>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-2">
        <div className="space-y-1">
          {suggestionLines.length === 0 && <p className="text-xs text-slate-500">Belum ada line untuk ditampilkan.</p>}
          {suggestionLines.map((line) => (
            <div key={line.id} className="grid w-full grid-cols-[56px_1fr_16px] items-center gap-2 rounded-sm px-1 py-1">
              <span className="inline-flex justify-center rounded bg-white/10 px-1.5 py-0.5 text-sm font-semibold text-white">
                {line.evalLabel}
              </span>
              <span className="truncate text-sm text-slate-200">{line.line}</span>
              <span className="text-slate-500">▾</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-2">
        <div className="flex items-center justify-between">
          <p className="truncate text-base text-slate-200">{openingName}</p>
          <button type="button" className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300">
            <BookOpen size={13} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xl font-semibold leading-none text-white">White - Black *</p>
          <button type="button" className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300">
            <Ellipsis size={14} />
          </button>
        </div>

        <div className="space-y-1 text-sm">
          {moveRows.length === 0 && <p className="text-slate-400">Belum ada langkah.</p>}
          {moveRows.map((row) => (
            <div key={row.number} className="grid grid-cols-[26px_1fr_1fr] items-center gap-2 rounded px-1 py-0.5 hover:bg-white/5">
              <span className="text-xs text-slate-500">{row.number}.</span>
              <button
                onClick={() => onJumpToPly(row.whitePly)}
                className={`rounded px-1 py-0.5 text-left font-medium ${
                  timelineIndex === row.whitePly ? 'bg-[#5f8f3f] text-white' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                {row.white ?? '-'}
              </button>
              <button
                onClick={() => row.black && onJumpToPly(row.blackPly)}
                className={`rounded px-1 py-0.5 text-left font-medium ${
                  timelineIndex === row.blackPly ? 'bg-[#5f8f3f] text-white' : 'text-slate-200 hover:bg-white/10'
                }`}
                disabled={!row.black}
              >
                {row.black ?? ''}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;