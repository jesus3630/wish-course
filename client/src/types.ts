export interface Slide {
  slide_number: number | null;
  slide_name: string | null;
  instructions: string | null;
  text: string | null;
  original_index?: number;
  screenshot?: string;
  video_start?: number;
  video_end?: number;
  simulation_url?: string | null;
  demo_prompts?: string[] | null;
  /**
   * Screens that behave differently by permission level. One course is taught to
   * everyone, so a screen that hides or locks a field says so here and the player
   * shows both views side by side.
   */
  access_note?: {
    requires: string;   // permission that unlocks the fuller view
    base: string;       // what standard access shows
    elevated: string;   // what the higher permission shows
    field?: string;     // the field or area in question
  } | null;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  review_slide?: number; // 1-based slide to re-read after misses; auto-matched when absent
}

// Knowledge Check state lives in ModulePlayer so it survives a trip back to the
// slides for review — the learner returns to the question they were locked out of.
export interface QuizSession {
  currentQ: number;
  answers: boolean[];      // one per completed question: correct on the very first try?
  locked: number[];        // ORIGINAL option indices ruled out on the current question
  wrongThisRound: number;  // wrong attempts since the last review trip
  reviewCount: number;     // review trips taken on the current question
  solved: boolean;         // current question answered correctly
  showResults: boolean;
  // Display order for the current question: position → original option index.
  // Empty means "not built yet"; Quiz fills it in on first render of a question.
  order: number[];
  // Shuffle options on every question. Set on a retake so nobody can pass by
  // remembering "it was the third one" — they have to read for the answer.
  shuffle: boolean;
}

export const FRESH_QUIZ_SESSION: QuizSession = {
  currentQ: 0,
  answers: [],
  locked: [],
  wrongThisRound: 0,
  reviewCount: 0,
  solved: false,
  showResults: false,
  order: [],
  shuffle: false,
};

// Fisher-Yates over 0..n-1, never returning the original order.
// A plain shuffle of four options lands back on the authored order about once in
// twenty-four — and on those retakes the learner sees exactly what they saw before,
// which is the one thing the shuffle exists to prevent. Retry until it actually moves.
export function shuffledOrder(n: number): number[] {
  if (n < 2) return Array.from({ length: n }, (_, i) => i);
  const identity = Array.from({ length: n }, (_, i) => i);
  for (let attempt = 0; attempt < 12; attempt++) {
    const a = [...identity];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((v, i) => v !== identity[i])) return a;
  }
  // Astronomically unlikely; a single swap still guarantees a different order
  const a = [...identity];
  [a[0], a[1]] = [a[1], a[0]];
  return a;
}

export interface ModuleVideo {
  title: string;
  src: string;
}

export interface Module {
  id: string;
  name: string;
  slides: Slide[];
  quiz?: QuizQuestion[];
  videos?: ModuleVideo[];
  video_url?: string;
}

export interface SlideProgress {
  viewed: boolean;
}

export interface ModuleProgress {
  started: boolean;
  completed: boolean;
  quiz_score: number | null;
  quiz_passed: boolean;
  slides_viewed: number[];
  last_slide: number;
}

export interface CourseProgress {
  user_name: string;
  user_email: string;
  started_at: string;
  modules: Record<string, ModuleProgress>;
  assigned_modules: string[] | null; // null = all modules
  completed_at?: string;
}
