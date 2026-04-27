import { CourseProgress, ModuleProgress } from '../types';

const STORAGE_KEY = 'wish_course_progress';

export function getProgress(): CourseProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProgress(progress: CourseProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function createProgress(name: string, email: string): CourseProgress {
  return {
    user_name: name,
    user_email: email,
    started_at: new Date().toISOString(),
    modules: {},
  };
}

export function getModuleProgress(progress: CourseProgress, moduleId: string): ModuleProgress {
  return progress.modules[moduleId] ?? {
    started: false,
    completed: false,
    quiz_score: null,
    quiz_passed: false,
    slides_viewed: [],
    last_slide: 0,
  };
}

export function markSlideViewed(
  progress: CourseProgress,
  moduleId: string,
  slideIndex: number
): CourseProgress {
  const mod = getModuleProgress(progress, moduleId);
  const slides_viewed = mod.slides_viewed.includes(slideIndex)
    ? mod.slides_viewed
    : [...mod.slides_viewed, slideIndex];

  return {
    ...progress,
    modules: {
      ...progress.modules,
      [moduleId]: {
        ...mod,
        started: true,
        slides_viewed,
        last_slide: Math.max(mod.last_slide, slideIndex),
      },
    },
  };
}

export function markModuleComplete(
  progress: CourseProgress,
  moduleId: string,
  quizScore: number,
  passed: boolean
): CourseProgress {
  const mod = getModuleProgress(progress, moduleId);
  return {
    ...progress,
    modules: {
      ...progress.modules,
      [moduleId]: {
        ...mod,
        completed: passed,
        quiz_score: quizScore,
        quiz_passed: passed,
      },
    },
  };
}

export function resetModuleProgress(
  progress: CourseProgress,
  moduleId: string
): CourseProgress {
  return {
    ...progress,
    modules: {
      ...progress.modules,
      [moduleId]: {
        started: false,
        completed: false,
        quiz_score: null,
        quiz_passed: false,
        slides_viewed: [],
        last_slide: 0,
      },
    },
  };
}

export function getOverallCompletion(progress: CourseProgress, totalModules: number): number {
  const completed = Object.values(progress.modules).filter(m => m.completed).length;
  return Math.round((completed / totalModules) * 100);
}

export async function syncProgressToServer(progress: CourseProgress): Promise<void> {
  try {
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: progress.user_email, progress }),
    });
  } catch { /* fire and forget */ }
}

export async function fetchProgressFromServer(email: string): Promise<CourseProgress | null> {
  try {
    const res = await fetch(`/api/progress/${encodeURIComponent(email)}`);
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}
