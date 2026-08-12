import { QuizQuestion, Slide } from '../types';

// Which slide should a learner re-read when they miss a Knowledge Check question?
//
// Questions carry no slide reference, so we match on content: the question text plus
// its correct answer are scored against every slide in the module using IDF-weighted
// token overlap. Words that appear on most slides (WISH, employee, click) carry almost
// no weight; words that appear on one or two slides carry a lot. Slide titles count
// double — a title match is a strong signal the slide is *about* that topic.
//
// An explicit `review_slide` on the question (1-based, editable in the admin panel)
// always wins over the automatic match.

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does', 'for',
  'from', 'has', 'have', 'how', 'if', 'in', 'into', 'is', 'it', 'its', 'not', 'of',
  'on', 'or', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'to', 'was', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you',
  'your', 'we', 'us', 'our', 'all', 'any', 'each', 'both', 'more', 'most', 'other',
  'some', 'such', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also', 'about',
  'after', 'before', 'once', 'over', 'under', 'again', 'been', 'being', 'were', 'would',
  'should', 'could', 'may', 'might', 'must', 'need', 'want', 'get', 'got', 'let', 'make',
  'made', 'use', 'used', 'using', 'one', 'two', 'three', 'first', 'next', 'last',
]);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// Congratulations / Next Steps slides repeat a lot of the module's vocabulary, so they
// score well and win matches they have no business winning. They teach nothing — skip them.
const WRAP_UP_TITLE = /congratulation|next steps|wrap[- ]?up|summary|conclusion|you'?re done|module complete/i;

function isTeachingSlide(slide: Slide): boolean {
  const s = slide as any;
  if (s?.completion_card || s?.next_steps_card) return false;
  return !WRAP_UP_TITLE.test(slide?.slide_name ?? '');
}

/**
 * Best slide to send a learner back to for `question`.
 * Returns a 0-based index into `slides`, or null when there is nothing to match against.
 */
export function pickReviewSlide(question: QuizQuestion, slides: Slide[]): number | null {
  if (!slides || slides.length === 0) return null;

  const explicit = (question as any).review_slide;
  if (typeof explicit === 'number' && explicit >= 1 && explicit <= slides.length) {
    return explicit - 1;
  }

  const correctAnswer = question.options?.[question.correct_index] ?? '';
  const query = tokenize(`${question.question} ${correctAnswer} ${question.explanation ?? ''}`);
  if (query.length === 0) return null;

  // Per-slide token sets — body and title kept separate so titles can be weighted higher
  const bodies = slides.map(s => new Set(tokenize(`${s.text ?? ''} ${s.instructions ?? ''}`)));
  const titles = slides.map(s => new Set(tokenize(s.slide_name ?? '')));

  // IDF over the module's slides: a word on every slide tells us nothing
  const uniqueQuery = query.filter((w, i) => query.indexOf(w) === i);
  const idf = new Map<string, number>();
  for (const word of uniqueQuery) {
    let docs = 0;
    for (let i = 0; i < slides.length; i++) {
      if (bodies[i].has(word) || titles[i].has(word)) docs++;
    }
    idf.set(word, docs === 0 ? 0 : Math.log(slides.length / docs) + 0.25);
  }

  let bestIndex: number | null = null;
  let bestScore = 0;
  for (let i = 0; i < slides.length; i++) {
    if (!isTeachingSlide(slides[i])) continue; // never send someone back to a wrap-up slide
    let score = 0;
    for (const word of uniqueQuery) {
      const weight = idf.get(word) ?? 0;
      if (weight === 0) continue;
      if (titles[i].has(word)) score += weight * 2;
      else if (bodies[i].has(word)) score += weight;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}
