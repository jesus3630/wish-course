export interface Slide {
  slide_number: number | null;
  slide_name: string | null;
  instructions: string | null;
  text: string | null;
  original_index?: number;
  screenshot?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
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
}
