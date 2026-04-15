import { Opening } from '../types/chess';

const LOCAL_OPENING_FILES = [
  '/opening-book/ecoA.json',
  '/opening-book/ecoB.json',
  '/opening-book/ecoC.json',
  '/opening-book/ecoD.json',
  '/opening-book/ecoE.json',
  '/opening-book/eco_interpolated.json',
];

type RawOpening = {
  eco?: string;
  name?: string;
  moves?: string;
  fen?: string;
};

function normalizeMoves(moves: string): string {
  return moves
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectEntries(payload: unknown): RawOpening[] {
  if (Array.isArray(payload)) {
    return payload as RawOpening[];
  }

  if (payload && typeof payload === 'object') {
    return Object.entries(payload as Record<string, RawOpening>).map(([fen, value]) => ({
      ...value,
      fen: value?.fen ?? fen,
    }));
  }

  return [];
}

function toOpening(item: RawOpening): Opening | null {
  const eco = (item.eco ?? '').trim().toUpperCase();
  const name = (item.name ?? '').trim();
  const moves = normalizeMoves(item.moves ?? '');

  if (!eco || !name || !moves) {
    return null;
  }

  return {
    eco,
    name,
    moves,
    fen: item.fen,
  };
}

export async function fetchAllOpenings(): Promise<Opening[]> {
  try {
    // Opening book dibaca dari folder lokal public/opening-book.
    const responses = await Promise.allSettled(
      LOCAL_OPENING_FILES.map(async (filePath) => {
        const response = await fetch(filePath);

        if (!response.ok) {
          throw new Error(`${filePath} tidak ditemukan (${response.status})`);
        }

        return response.json();
      })
    );

    const merged = responses
      .filter((result): result is PromiseFulfilledResult<unknown> => result.status === 'fulfilled')
      .flatMap((result) => collectEntries(result.value))
      .map(toOpening)
      .filter((entry): entry is Opening => Boolean(entry));

    const deduped = new Map<string, Opening>();

    for (const opening of merged) {
      const key = `${opening.eco}|${opening.name.toLowerCase()}|${opening.moves}`;

      if (!deduped.has(key)) {
        deduped.set(key, opening);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => {
      const ecoCompare = a.eco.localeCompare(b.eco);
      if (ecoCompare !== 0) {
        return ecoCompare;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error fetching ECO data:', error);
    return [];
  }
}
