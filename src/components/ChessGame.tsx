import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  Gamepad2,
  GraduationCap,
  Home,
  List,
  Search,
  Settings,
  SkipBack,
  SkipForward,
  Swords,
} from 'lucide-react';
import { fetchAllOpenings } from '../services/ecoService';
import { Opening } from '../types/chess';
import AnalysisPanel from '../features/analysis/AnalysisPanel';
import ExplorePanel from '../features/explore/ExplorePanel';
import GamesPanel, { QuizQuestion } from '../features/games/GamesPanel';

type MoveHighlight = {
  from: Square;
  to: Square;
};

type MainMode = 'analysis' | 'games' | 'explore';
type LeftNavAction = 'home' | 'play' | 'learn' | 'book' | 'search';

const START_CHESS = new Chess();
const START_FEN = START_CHESS.fen();

function toPublicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\//, '')}`;
}

function splitMoves(moves: string): string[] {
  return moves
    .replace(/\d+\.\.\./g, ' ')
    .replace(/\d+\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((move) => move && !['*', '1-0', '0-1', '1/2-1/2'].includes(move));
}

function normalizeSan(san: string): string {
  return san.replace(/[+#?!]/g, '').trim();
}

function getOpeningKey(opening: Opening): string {
  return `${opening.eco}-${opening.name}-${opening.moves}`;
}

function buildTimelineFromMoves(moves: string[]): {
  fens: string[];
  sans: string[];
  lastMoves: MoveHighlight[];
} {
  const chess = new Chess();
  const fens = [chess.fen()];
  const sans: string[] = [];
  const lastMoves: MoveHighlight[] = [];

  for (const move of moves) {
    try {
      const applied = chess.move(move);
      if (!applied) {
        break;
      }
      sans.push(applied.san);
      lastMoves.push({
        from: applied.from as Square,
        to: applied.to as Square,
      });
      fens.push(chess.fen());
    } catch {
      break;
    }
  }

  return { fens, sans, lastMoves };
}

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const ChessGame: React.FC = () => {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<MainMode>('analysis');
  const [activeLeftNav, setActiveLeftNav] = useState<LeftNavAction>('home');
  const [search, setSearch] = useState('');

  const [selectedOpeningKey, setSelectedOpeningKey] = useState<string | null>(null);
  const [timelineFens, setTimelineFens] = useState<string[]>([START_FEN]);
  const [timelineSans, setTimelineSans] = useState<string[]>([]);
  const [timelineLastMoves, setTimelineLastMoves] = useState<MoveHighlight[]>([]);
  const [timelineIndex, setTimelineIndex] = useState(0);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalTargetSquares, setLegalTargetSquares] = useState<Square[]>([]);
  const [rightClickedSquares, setRightClickedSquares] = useState<Partial<Record<Square, boolean>>>({});

  const [engineReady, setEngineReady] = useState(false);
  const [engineBusy, setEngineBusy] = useState(false);
  const [engineEval, setEngineEval] = useState('');
  const [engineBestMove, setEngineBestMove] = useState('');
  const [enginePv, setEnginePv] = useState('');
  const [engineError, setEngineError] = useState<string | null>(null);

  const [quizQuestion, setQuizQuestion] = useState<QuizQuestion | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [quizScoreCorrect, setQuizScoreCorrect] = useState(0);
  const [quizScoreTotal, setQuizScoreTotal] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const fen = timelineFens[timelineIndex] ?? START_FEN;
  const lastMove = timelineIndex > 0 ? timelineLastMoves[timelineIndex - 1] ?? null : null;

  const movePool = useMemo(() => {
    const set = new Set<string>();
    openings.forEach((opening) => {
      splitMoves(opening.moves).forEach((move) => set.add(move));
    });
    return Array.from(set);
  }, [openings]);

  const selectedOpening = useMemo(() => {
    if (!selectedOpeningKey) {
      return null;
    }
    return openings.find((opening) => getOpeningKey(opening) === selectedOpeningKey) ?? null;
  }, [openings, selectedOpeningKey]);

  const selectedOpeningMoves = useMemo(() => {
    if (!selectedOpening) {
      return [];
    }
    return splitMoves(selectedOpening.moves);
  }, [selectedOpening]);

  const filteredOpenings = useMemo(() => {
    if (!search.trim()) {
      return openings;
    }
    const q = search.toLowerCase();
    return openings.filter((opening) => opening.name.toLowerCase().includes(q) || opening.eco.toLowerCase().includes(q));
  }, [openings, search]);

  const openingMoveRows = useMemo(() => {
    const rows: { number: number; white?: string; black?: string; whitePly: number; blackPly: number }[] = [];
    for (let i = 0; i < selectedOpeningMoves.length; i += 2) {
      rows.push({
        number: i / 2 + 1,
        white: selectedOpeningMoves[i],
        black: selectedOpeningMoves[i + 1],
        whitePly: i + 1,
        blackPly: i + 2,
      });
    }
    return rows;
  }, [selectedOpeningMoves]);

  const analysisMoveRows = useMemo(() => {
    const rows: { number: number; white?: string; black?: string; whitePly: number; blackPly: number }[] = [];
    for (let i = 0; i < timelineSans.length; i += 2) {
      rows.push({
        number: i / 2 + 1,
        white: timelineSans[i],
        black: timelineSans[i + 1],
        whitePly: i + 1,
        blackPly: i + 2,
      });
    }
    return rows;
  }, [timelineSans]);

  const analysisSuggestionLines = useMemo(() => {
    const lines: { id: string; evalLabel: string; line: string }[] = [];

    if (engineEval || enginePv || engineBestMove) {
      lines.push({
        id: 'engine',
        evalLabel: engineEval || '+0.00',
        line: enginePv || engineBestMove || 'Engine sedang menganalisa...',
      });
    }

    const bookContinuation = selectedOpeningMoves.slice(timelineIndex, timelineIndex + 8).join(' ');
    if (bookContinuation) {
      lines.push({
        id: 'book',
        evalLabel: 'Book',
        line: bookContinuation,
      });
    }

    return lines.slice(0, 3);
  }, [engineBestMove, engineEval, enginePv, selectedOpeningMoves, timelineIndex]);

  const clearBoardMarks = useCallback(() => {
    setSelectedSquare(null);
    setLegalTargetSquares([]);
    setRightClickedSquares({});
  }, []);

  const loadOpeningTimeline = useCallback(
    (opening: Opening, atPly?: number) => {
      const openingMoves = splitMoves(opening.moves);
      const timeline = buildTimelineFromMoves(openingMoves);
      const maxPly = timeline.sans.length;
      const nextPly = typeof atPly === 'number' ? Math.max(0, Math.min(atPly, maxPly)) : maxPly;

      setSelectedOpeningKey(getOpeningKey(opening));
      setTimelineFens(timeline.fens);
      setTimelineSans(timeline.sans);
      setTimelineLastMoves(timeline.lastMoves);
      setTimelineIndex(nextPly);
      clearBoardMarks();
    },
    [clearBoardMarks],
  );

  const resetToStart = useCallback(() => {
    setTimelineFens([START_FEN]);
    setTimelineSans([]);
    setTimelineLastMoves([]);
    setTimelineIndex(0);
    setSelectedOpeningKey(null);
    setQuizQuestion(null);
    setQuizFeedback(null);
    clearBoardMarks();
  }, [clearBoardMarks]);

  const jumpToPly = useCallback((ply: number) => {
    const safePly = Math.max(0, Math.min(ply, timelineFens.length - 1));
    setTimelineIndex(safePly);
    setSelectedSquare(null);
    setLegalTargetSquares([]);
  }, [timelineFens.length]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      const data = await fetchAllOpenings();

      if (!mounted) {
        return;
      }

      if (data.length === 0) {
        setLoadError('Data opening kosong. Isi file di public/opening-book (ecoA-ecoE dan eco_interpolated).');
        setIsLoading(false);
        return;
      }

      setOpenings(data);
      loadOpeningTimeline(data[0]);
      setIsLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [loadOpeningTimeline]);

  useEffect(() => {
    let canceled = false;
    let readySeen = false;

    const terminateCurrentWorker = () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };

    const workerScriptUrl = toPublicUrl('engine/stockfish-17-lite-single.js');
    const workerBaseUrl = toPublicUrl('engine/');

    setEngineReady(false);
    setEngineBusy(false);
    setEngineError('Memuat engine lokal...');

    try {
      terminateCurrentWorker();

      const workerBootScript = `
self.Te = ${JSON.stringify(workerBaseUrl)};
importScripts(${JSON.stringify(workerScriptUrl)});
`;

      const blob = new Blob([workerBootScript], { type: 'text/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);
      workerRef.current = worker;

      const initTimeoutId = window.setTimeout(() => {
        if (!readySeen && !canceled) {
          setEngineReady(false);
          setEngineBusy(false);
          setEngineError('Engine lokal belum aktif. Isi file public/engine/stockfish-17-lite-single.js.');
        }
      }, 6000);

      worker.onmessage = (event) => {
        const line = String(event.data ?? '').trim();
        if (!line) {
          return;
        }

        if (line === 'readyok') {
          readySeen = true;
          window.clearTimeout(initTimeoutId);
          setEngineReady(true);
          setEngineError(null);
          return;
        }

        if (line.startsWith('info depth')) {
          const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
          if (scoreMatch) {
            const [, type, raw] = scoreMatch;
            if (type === 'cp') {
              const pawns = Number(raw) / 100;
              setEngineEval(`${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`);
            } else {
              const mateScore = Number(raw);
              setEngineEval(`M${mateScore > 0 ? '+' : ''}${mateScore}`);
            }
          }

          const pvMatch = line.match(/\spv\s(.+)$/);
          if (pvMatch?.[1]) {
            setEnginePv(pvMatch[1]);
          }
          return;
        }

        if (line.startsWith('bestmove')) {
          const best = line.split(' ')[1] ?? '(none)';
          setEngineBestMove(best);
          setEngineBusy(false);
        }
      };

      worker.onerror = () => {
        setEngineReady(false);
        setEngineBusy(false);
        setEngineError('Engine lokal gagal dimuat. Periksa file public/engine/stockfish-17-lite-single.js.');
      };

      worker.postMessage('uci');
      worker.postMessage('isready');
      worker.postMessage('setoption name MultiPV value 1');

      return () => {
        canceled = true;
        window.clearTimeout(initTimeoutId);
        terminateCurrentWorker();
      };
    } catch {
      setEngineReady(false);
      setEngineBusy(false);
      setEngineError('Engine lokal gagal dimuat. Periksa file public/engine/stockfish-17-lite-single.js.');
      return () => {
        canceled = true;
        terminateCurrentWorker();
      };
    }
  }, []);

  useEffect(() => {
    if (mode !== 'analysis' || !engineReady || !workerRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const worker = workerRef.current;
      if (!worker) {
        return;
      }

      setEngineBusy(true);
      worker.postMessage('stop');
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage('go depth 12');
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fen, mode, engineReady]);

  const setSelectableSquare = useCallback((square: Square) => {
    const chess = new Chess(fen);
    const piece = chess.get(square);
    if (!piece || piece.color !== chess.turn()) {
      setSelectedSquare(null);
      setLegalTargetSquares([]);
      return;
    }

    const legalMoves = (chess.moves({ square, verbose: true }) as { to: Square }[]).map((move) => move.to);
    setSelectedSquare(square);
    setLegalTargetSquares(legalMoves);
  }, [fen]);

  const commitMove = useCallback(
    (from: Square, to: Square): boolean => {
      const chess = new Chess(fen);

      try {
        const move = chess.move({ from, to, promotion: 'q' });
        if (!move) {
          return false;
        }

        const nextFens = timelineFens.slice(0, timelineIndex + 1);
        const nextSans = timelineSans.slice(0, timelineIndex);
        const nextLastMoves = timelineLastMoves.slice(0, timelineIndex);

        nextFens.push(chess.fen());
        nextSans.push(move.san);
        nextLastMoves.push({ from: move.from as Square, to: move.to as Square });

        setTimelineFens(nextFens);
        setTimelineSans(nextSans);
        setTimelineLastMoves(nextLastMoves);
        setTimelineIndex(timelineIndex + 1);

        setSelectedSquare(null);
        setLegalTargetSquares([]);
        return true;
      } catch {
        return false;
      }
    },
    [fen, timelineFens, timelineIndex, timelineLastMoves, timelineSans],
  );

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare) {
        return false;
      }

      return commitMove(sourceSquare as Square, targetSquare as Square);
    },
    [commitMove],
  );

  const onSquareClick = useCallback(
    ({ square }: { square: string }) => {
      const currentSquare = square as Square;
      setRightClickedSquares({});

      if (!selectedSquare) {
        setSelectableSquare(currentSquare);
        return;
      }

      if (selectedSquare === currentSquare) {
        setSelectedSquare(null);
        setLegalTargetSquares([]);
        return;
      }

      if (commitMove(selectedSquare, currentSquare)) {
        return;
      }

      setSelectableSquare(currentSquare);
    },
    [commitMove, selectedSquare, setSelectableSquare],
  );

  const onSquareRightClick = useCallback(({ square }: { square: string }) => {
    const currentSquare = square as Square;
    setRightClickedSquares((prev) => {
      const next = { ...prev };
      if (next[currentSquare]) {
        delete next[currentSquare];
      } else {
        next[currentSquare] = true;
      }
      return next;
    });
  }, []);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    const mergeSquareStyle = (square: Square, style: React.CSSProperties) => {
      styles[square] = {
        ...(styles[square] ?? {}),
        ...style,
      };
    };

    if (lastMove) {
      mergeSquareStyle(lastMove.from, { backgroundColor: 'rgba(245, 158, 11, 0.32)' });
      mergeSquareStyle(lastMove.to, { backgroundColor: 'rgba(245, 158, 11, 0.32)' });
    }

    if (selectedSquare) {
      mergeSquareStyle(selectedSquare, { boxShadow: 'inset 0 0 0 3px rgba(59, 130, 246, 0.75)' });
    }

    legalTargetSquares.forEach((square) => {
      mergeSquareStyle(square, {
        backgroundImage: 'radial-gradient(circle, rgba(16, 185, 129, 0.95) 0 16%, transparent 17%)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      });
    });

    Object.keys(rightClickedSquares).forEach((square) => {
      mergeSquareStyle(square as Square, { backgroundColor: 'rgba(239, 68, 68, 0.5)' });
    });

    return styles;
  }, [lastMove, selectedSquare, legalTargetSquares, rightClickedSquares]);

  const navigateTimeline = useCallback(
    (direction: 'start' | 'prev' | 'next' | 'end') => {
      let nextIndex = timelineIndex;

      if (direction === 'start') {
        nextIndex = 0;
      } else if (direction === 'prev') {
        nextIndex = Math.max(0, timelineIndex - 1);
      } else if (direction === 'next') {
        nextIndex = Math.min(timelineFens.length - 1, timelineIndex + 1);
      } else {
        nextIndex = timelineFens.length - 1;
      }

      if (nextIndex !== timelineIndex) {
        setTimelineIndex(nextIndex);
        setSelectedSquare(null);
        setLegalTargetSquares([]);
      }
    },
    [timelineFens.length, timelineIndex],
  );

  const createQuizQuestion = useCallback((): QuizQuestion | null => {
    if (openings.length === 0 || movePool.length < 6) {
      return null;
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const opening = openings[Math.floor(Math.random() * openings.length)];
      const moves = splitMoves(opening.moves);

      if (moves.length < 4) {
        continue;
      }

      const targetPly = Math.floor(Math.random() * Math.min(10, moves.length - 1)) + 2;
      const setupMoves = moves.slice(0, targetPly - 1);
      const correctMove = moves[targetPly - 1];
      const distractors = shuffle(movePool.filter((move) => normalizeSan(move) !== normalizeSan(correctMove))).slice(0, 3);

      if (distractors.length < 3) {
        continue;
      }

      const setupTimeline = buildTimelineFromMoves(setupMoves);
      setSelectedOpeningKey(getOpeningKey(opening));
      setTimelineFens(setupTimeline.fens);
      setTimelineSans(setupTimeline.sans);
      setTimelineLastMoves(setupTimeline.lastMoves);
      setTimelineIndex(setupTimeline.fens.length - 1);
      clearBoardMarks();

      const sideLabel = targetPly % 2 === 1 ? 'Putih' : 'Hitam';
      return {
        openingName: `${opening.eco} - ${opening.name}`,
        prompt: `Giliran ${sideLabel}. Apa langkah utama selanjutnya?`,
        correctMove,
        options: shuffle([correctMove, ...distractors]),
      };
    }

    return null;
  }, [clearBoardMarks, movePool, openings]);

  const startNewQuizQuestion = useCallback(() => {
    const next = createQuizQuestion();
    setQuizQuestion(next);
    setQuizFeedback(null);
  }, [createQuizQuestion]);

  const answerQuizQuestion = useCallback(
    (selectedMove: string) => {
      if (!quizQuestion || quizFeedback) {
        return;
      }

      const isCorrect = normalizeSan(selectedMove) === normalizeSan(quizQuestion.correctMove);
      setQuizFeedback(isCorrect ? 'correct' : 'wrong');
      setQuizScoreTotal((prev) => prev + 1);
      if (isCorrect) {
        setQuizScoreCorrect((prev) => prev + 1);
      }
    },
    [quizFeedback, quizQuestion],
  );

  const handleModeChange = useCallback((nextMode: MainMode) => {
    setMode(nextMode);
    if (nextMode !== 'games') {
      setQuizFeedback(null);
    }
  }, []);

  const handleLeftNavAction = useCallback(
    (action: LeftNavAction) => {
      setActiveLeftNav(action);

      if (action === 'home') {
        resetToStart();
        handleModeChange('analysis');
        return;
      }

      if (action === 'play') {
        if (openings.length === 0) {
          return;
        }
        const randomOpening = openings[Math.floor(Math.random() * openings.length)];
        loadOpeningTimeline(randomOpening);
        handleModeChange('explore');
        return;
      }

      if (action === 'learn') {
        handleModeChange('explore');
        return;
      }

      if (action === 'book') {
        handleModeChange('games');
        if (!quizQuestion) {
          startNewQuizQuestion();
        }
        return;
      }

      handleModeChange('explore');
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    },
    [handleModeChange, loadOpeningTimeline, openings, quizQuestion, resetToStart, startNewQuizQuestion],
  );

  const leftNavButtonClass = useCallback(
    (action: LeftNavAction) =>
      `flex w-full items-center justify-center rounded-md p-2 transition ${
        activeLeftNav === action ? 'bg-[#2e2d2a] text-emerald-300' : 'text-slate-300 hover:bg-[#2a2926]'
      }`,
    [activeLeftNav],
  );

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#232220] text-slate-100">
      <div className="grid h-full w-full grid-cols-[74px_1fr] lg:grid-cols-[74px_1fr_430px]">
        <aside className="flex h-full flex-col justify-between border-r border-black/40 bg-[#1a1917] py-4">
          <div className="space-y-1 px-2">
            <div className="mb-4 flex items-center justify-center rounded-md bg-[#242320] py-2 text-xs font-semibold tracking-wide text-emerald-300">
              ECO
            </div>
            <button type="button" onClick={() => handleLeftNavAction('home')} title="Home" className={leftNavButtonClass('home')}>
              <Home size={18} />
            </button>
            <button type="button" onClick={() => handleLeftNavAction('play')} title="Random Opening" className={leftNavButtonClass('play')}>
              <Swords size={18} />
            </button>
            <button type="button" onClick={() => handleLeftNavAction('learn')} title="Openings" className={leftNavButtonClass('learn')}>
              <GraduationCap size={18} />
            </button>
            <button type="button" onClick={() => handleLeftNavAction('book')} title="Games Quiz" className={leftNavButtonClass('book')}>
              <BookOpen size={18} />
            </button>
          </div>

          <div className="space-y-2 px-2">
            <button type="button" onClick={() => handleLeftNavAction('search')} title="Search Opening" className={leftNavButtonClass('search')}>
              <Search size={18} />
            </button>
          </div>
        </aside>

        <section className="flex h-full flex-col bg-[#2b2a27]">
          <div className="flex items-center justify-between px-4 py-2 text-sm text-slate-200">
            <span className="font-semibold">Black</span>
            <span className="text-xs text-slate-400">
              {mode === 'analysis' ? 'Analysis Mode' : mode === 'games' ? 'Games Quiz Mode' : 'Explore Mode'}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center p-3 md:p-5">
            <div className="w-full max-w-[85vh]">
              <Chessboard
                options={{
                  position: fen,
                  onPieceDrop: onDrop,
                  onSquareClick,
                  onSquareRightClick,
                  squareStyles: customSquareStyles,
                  darkSquareStyle: { backgroundColor: '#769656' },
                  lightSquareStyle: { backgroundColor: '#eeeed2' },
                }}
              />
            </div>
          </div>

          <div className="border-t border-black/30 px-4 py-2 text-sm text-slate-200">White</div>
        </section>

        <aside className="hidden border-l border-black/40 bg-[#1f1e1b] lg:flex lg:h-full lg:flex-col">
          <div className="border-b border-black/30 px-4 pb-3 pt-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[30px] font-semibold leading-none">
                <Search size={24} className="text-slate-200" />
                <span className="text-2xl">Analysis</span>
              </div>
              <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200">
                <Settings size={15} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                onClick={() => handleModeChange('analysis')}
                className={`rounded-md px-3 py-2 transition ${
                  mode === 'analysis' ? 'bg-[#2b2a27] text-white' : 'text-slate-400 hover:bg-[#2b2a27]'
                }`}
              >
                <Search size={14} className="mx-auto mb-1" />
                Analysis
              </button>
              <button
                type="button"
                onClick={() => {
                  handleModeChange('games');
                  if (!quizQuestion) {
                    startNewQuizQuestion();
                  }
                }}
                className={`rounded-md px-3 py-2 transition ${
                  mode === 'games' ? 'bg-[#2b2a27] text-white' : 'text-slate-400 hover:bg-[#2b2a27]'
                }`}
              >
                <Gamepad2 size={14} className="mx-auto mb-1" />
                Games
              </button>
              <button
                onClick={() => handleModeChange('explore')}
                className={`rounded-md px-3 py-2 transition ${
                  mode === 'explore' ? 'bg-[#2b2a27] text-white' : 'text-slate-400 hover:bg-[#2b2a27]'
                }`}
              >
                <Compass size={14} className="mx-auto mb-1" />
                Explore
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {mode === 'analysis' && (
              <AnalysisPanel
                isLoading={isLoading}
                loadError={loadError}
                engineReady={engineReady}
                engineBusy={engineBusy}
                engineEval={engineEval}
                engineBestMove={engineBestMove}
                engineError={engineError}
                suggestionLines={analysisSuggestionLines}
                openingName={selectedOpening?.name ?? 'Custom Analysis'}
                moveRows={analysisMoveRows}
                timelineIndex={timelineIndex}
                onJumpToPly={jumpToPly}
              />
            )}

            {mode === 'games' && (
              <GamesPanel
                isLoading={isLoading}
                loadError={loadError}
                question={quizQuestion}
                scoreCorrect={quizScoreCorrect}
                scoreTotal={quizScoreTotal}
                feedback={quizFeedback}
                onNewQuestion={startNewQuizQuestion}
                onAnswer={answerQuizQuestion}
              />
            )}

            {mode === 'explore' && (
              <ExplorePanel
                isLoading={isLoading}
                loadError={loadError}
                search={search}
                onSearchChange={setSearch}
                searchInputRef={searchInputRef}
                openings={filteredOpenings}
                selectedOpeningKey={selectedOpeningKey}
                onSelectOpening={(opening) => loadOpeningTimeline(opening)}
                moveRows={openingMoveRows}
                timelineIndex={timelineIndex}
                onJumpToPly={(ply) => {
                  if (selectedOpening) {
                    loadOpeningTimeline(selectedOpening, ply);
                  }
                }}
              />
            )}
          </div>

          <div className="border-t border-black/30 p-3">
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => navigateTimeline('start')}
                className="rounded-xl border border-white/5 bg-[#2d2c29] py-2 text-slate-200 hover:bg-[#3a3935] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={timelineIndex <= 0}
              >
                <SkipBack size={16} className="mx-auto" />
              </button>
              <button
                onClick={() => navigateTimeline('prev')}
                className="rounded-xl border border-white/5 bg-[#2d2c29] py-2 text-slate-200 hover:bg-[#3a3935] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={timelineIndex <= 0}
              >
                <ChevronLeft size={16} className="mx-auto" />
              </button>
              <button
                onClick={() => navigateTimeline('next')}
                className="rounded-xl border border-white/5 bg-[#2d2c29] py-2 text-slate-200 hover:bg-[#3a3935] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={timelineIndex >= timelineFens.length - 1}
              >
                <ChevronRight size={16} className="mx-auto" />
              </button>
              <button
                onClick={() => navigateTimeline('end')}
                className="rounded-xl border border-white/5 bg-[#2d2c29] py-2 text-slate-200 hover:bg-[#3a3935] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={timelineIndex >= timelineFens.length - 1}
              >
                <SkipForward size={16} className="mx-auto" />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <List size={13} />
                {timelineIndex}/{Math.max(timelineFens.length - 1, 0)} ply
              </span>
              <span>{mode === 'analysis' ? 'Analysis' : mode === 'games' ? 'Games Quiz' : 'Opening Explorer'}</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default ChessGame;