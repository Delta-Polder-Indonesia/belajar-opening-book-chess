export interface Opening {
  eco: string;
  name: string;
  moves: string;
  fen?: string;
}

export type Language = 'id' | 'en';

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export type RepetitionItem = {
  id: string;
  opening: Opening;
  prompt: string;
  answer: string;
  intervalDays: number;
  dueAt: number;
  streak: number;
};

export interface ChessState {
  fen: string;
  moveHistory: string[];
  currentOpening?: Opening;
}
