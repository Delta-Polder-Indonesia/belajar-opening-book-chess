import React from 'react';

export interface QuizQuestion {
  prompt: string;
  options: string[];
  correctMove: string;
  openingName: string;
}

interface GamesPanelProps {
  isLoading: boolean;
  loadError: string | null;
  question: QuizQuestion | null;
  scoreCorrect: number;
  scoreTotal: number;
  feedback: 'correct' | 'wrong' | null;
  onNewQuestion: () => void;
  onAnswer: (move: string) => void;
}

const GamesPanel: React.FC<GamesPanelProps> = ({
  isLoading,
  loadError,
  question,
  scoreCorrect,
  scoreTotal,
  feedback,
  onNewQuestion,
  onAnswer,
}) => {
  if (isLoading) {
    return <p className="px-4 py-3 text-sm text-slate-300">Memuat opening book...</p>;
  }

  if (loadError) {
    return <p className="px-4 py-3 text-sm text-rose-300">{loadError}</p>;
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-xs text-slate-400">Opening Quiz</p>
        <p className="text-sm font-semibold text-white">
          Score: {scoreCorrect}/{scoreTotal}
        </p>
      </div>

      {!question && (
        <button
          type="button"
          onClick={onNewQuestion}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Mulai Quiz
        </button>
      )}

      {question && (
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-400">{question.openingName}</p>
            <p className="mt-1 text-sm text-slate-100">{question.prompt}</p>
          </div>

          <div className="space-y-2">
            {question.options.map((option) => {
              const isCorrect = feedback && option === question.correctMove;
              const isWrongPicked = feedback === 'wrong' && option !== question.correctMove;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onAnswer(option)}
                  disabled={Boolean(feedback)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                    isCorrect
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : isWrongPicked
                        ? 'border-white/10 bg-white/5 text-slate-400'
                        : 'border-white/10 bg-[#2b2a27] text-slate-200 hover:bg-[#34332f]'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className="space-y-2">
              <p className={`text-sm font-semibold ${feedback === 'correct' ? 'text-emerald-300' : 'text-amber-300'}`}>
                {feedback === 'correct' ? 'Benar.' : `Kurang tepat. Jawaban: ${question.correctMove}`}
              </p>
              <button
                type="button"
                onClick={onNewQuestion}
                className="w-full rounded-md border border-white/10 bg-[#2b2a27] px-3 py-2 text-sm text-slate-100 hover:bg-[#34332f]"
              >
                Soal Berikutnya
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GamesPanel;