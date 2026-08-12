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

// Fisher-Yates over 0..n-1
export function shuffledOrder(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
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
