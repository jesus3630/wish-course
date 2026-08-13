/**
 * The final exam.
 *
 * One exam for the whole course, not one per module. A sitting is one pass:
 * every question answered once, no second look, no answer revealed until it is
 * submitted and marked. 70% passes. Every sitting is recorded so we can see how
 * many attempts each person needed to reach 100%.
 *
 * ─── Why this file is written as classes ──────────────────────────────────────
 * Four responsibilities live here, and they change for different reasons:
 *
 *   ExamBlueprint    the RULES     — how long, what passes, how questions are drawn
 *   ExamAttempt      one SITTING   — the questions asked, the answers given, the mark
 *   ExamRepository   STORAGE       — how a sitting is written to and read from Postgres
 *   LearnerExamHistory  the STORY  — what all of one person's sittings add up to
 *
 * Keeping them apart means changing the pass mark never touches the SQL, and
 * moving to a different database never touches the marking. That separation is
 * the whole point of modelling with objects: each class owns one idea, holds the
 * data for that idea, and exposes behaviour instead of letting callers reach in
 * and manipulate its innards.
 *
 * Notice what none of these classes do: none of them talk to Express. They know
 * nothing about requests, responses, or status codes. That is deliberate — the
 * routes in index.js translate HTTP into these objects and back. You can test
 * every rule in here without starting a web server.
 */

const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// ExamBlueprint — the rules of the exam
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The policy object. Everything the business decided about the exam lives here
 * and nowhere else, so "make it 20 questions" or "raise the bar to 80%" is a
 * one-line change in one file.
 */
class ExamBlueprint {
  constructor({ questionCount = 25, passMark = 70, minQuestions = 10, maxQuestions = 25 } = {}) {
    // Clamp rather than throw: a bad config value should not take the exam offline.
    this.questionCount = Math.max(minQuestions, Math.min(maxQuestions, questionCount));
    this.passMark = passMark;
    this.minQuestions = minQuestions;
    this.maxQuestions = maxQuestions;
  }

  /** Does this percentage pass? The one place that answers the question. */
  isPass(scorePercent) {
    return scorePercent >= this.passMark;
  }

  /** A perfect score is what we track attempts-to-mastery against. */
  isPerfect(scorePercent) {
    return scorePercent >= 100;
  }

  /**
   * Draw the exam from the full question bank.
   *
   * Spread across chapters rather than taken at random from a flat list: 25
   * random draws from a 112-question pool can easily take six from one chapter
   * and none from another, which is not an exam over the whole course. We take
   * turns across chapters until the paper is full, so coverage is even and the
   * long chapters contribute a little more than the short ones.
   *
   * @param {Object} bank  { moduleId: [question, ...] }
   * @returns {Array} questions, each tagged with the module it came from
   */
  drawQuestions(bank) {
    const byModule = Object.entries(bank)
      .map(([moduleId, questions]) => ({
        moduleId,
        questions: shuffle((questions || []).filter(q => Array.isArray(q.options) && q.options.length > 1)),
      }))
      .filter(group => group.questions.length > 0);

    if (byModule.length === 0) return [];

    // Round-robin: one from each chapter, then a second from each, and so on.
    const drawn = [];
    let round = 0;
    while (drawn.length < this.questionCount) {
      const startedRound = drawn.length;
      for (const group of shuffle(byModule)) {
        if (drawn.length >= this.questionCount) break;
        const q = group.questions[round];
        if (q) drawn.push({ ...q, module_id: group.moduleId });
      }
      if (drawn.length === startedRound) break; // bank exhausted
      round++;
    }
    return shuffle(drawn);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ExamAttempt — one person's single sitting
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Holds the paper that was set and the answers that came back, and knows how to
 * mark itself.
 *
 * The correct answers never leave this object. `questionsForLearner()` returns
 * the paper with `correct_index` stripped out, because a one-chance exam whose
 * answers are readable in the browser's network tab is not a one-chance exam.
 * Marking happens here, on the server, against the copy the learner never sees.
 */
class ExamAttempt {
  constructor({ id, email, name, questions, attemptNo, startedAt }) {
    this.id = id || crypto.randomUUID();
    this.email = email;
    this.name = name || '';
    this.questions = questions;
    this.attemptNo = attemptNo;
    this.startedAt = startedAt || new Date();
  }

  /** The paper as the learner may see it — no answer key. */
  questionsForLearner() {
    return this.questions.map((q, i) => ({
      number: i + 1,
      id: q.id,
      module_id: q.module_id,
      question: q.question,
      options: q.options,
    }));
  }

  /**
   * Mark the paper.
   *
   * An unanswered question is wrong, not skipped — this is a single pass and a
   * blank is a decision not to answer. Returning a result object rather than
   * mutating hidden state keeps marking a pure calculation you can test.
   *
   * @param {Array} submitted  [{ id, chosen }]
   */
  mark(submitted, blueprint) {
    const chosenById = new Map((submitted || []).map(a => [a.id, a.chosen]));

    const answers = this.questions.map(q => {
      const chosen = chosenById.has(q.id) ? chosenById.get(q.id) : null;
      return {
        id: q.id,
        module_id: q.module_id,
        question: q.question,
        chosen,
        correct_index: q.correct_index,
        correct: chosen === q.correct_index,
        answered: chosen !== null && chosen !== undefined,
      };
    });

    const correct = answers.filter(a => a.correct).length;
    const total = answers.length;
    const score = total === 0 ? 0 : Math.round((correct / total) * 100);

    return {
      attemptId: this.id,
      email: this.email,
      name: this.name,
      attemptNo: this.attemptNo,
      correct,
      total,
      score,
      passed: blueprint.isPass(score),
      perfect: blueprint.isPerfect(score),
      unanswered: answers.filter(a => !a.answered).length,
      answers,
      startedAt: this.startedAt,
      submittedAt: new Date(),
      durationSeconds: Math.max(0, Math.round((Date.now() - new Date(this.startedAt).getTime()) / 1000)),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ExamRepository — everything that touches the database
// ─────────────────────────────────────────────────────────────────────────────
/**
 * All the SQL lives behind this one class. Nothing above it knows Postgres
 * exists, which is why the rules and the marking are testable on their own.
 *
 * In-flight papers are held in memory rather than written to the database: an
 * exam that is started and abandoned is not a result, and only a submitted
 * sitting counts as an attempt.
 */
class ExamRepository {
  constructor(pool) {
    this.pool = pool;
    this.openAttempts = new Map(); // attemptId -> ExamAttempt
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS exam_attempts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        attempt_no INTEGER NOT NULL,
        score INTEGER NOT NULL,
        correct INTEGER NOT NULL,
        total INTEGER NOT NULL,
        passed BOOLEAN NOT NULL,
        perfect BOOLEAN NOT NULL,
        unanswered INTEGER NOT NULL DEFAULT 0,
        answers JSONB NOT NULL,
        duration_seconds INTEGER,
        started_at TIMESTAMPTZ,
        submitted_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS exam_attempts_email_idx ON exam_attempts (email);
    `);
  }

  /** How many sittings this person has already submitted. */
  async attemptCount(email) {
    const r = await this.pool.query('SELECT COUNT(*)::int AS n FROM exam_attempts WHERE email = $1', [email]);
    return r.rows[0]?.n || 0;
  }

  holdOpen(attempt) {
    this.openAttempts.set(attempt.id, attempt);
    // Abandoned papers should not accumulate in memory forever.
    if (this.openAttempts.size > 500) {
      const oldest = [...this.openAttempts.entries()]
        .sort((a, b) => new Date(a[1].startedAt) - new Date(b[1].startedAt))
        .slice(0, 100);
      for (const [id] of oldest) this.openAttempts.delete(id);
    }
  }

  takeOpen(attemptId) {
    const attempt = this.openAttempts.get(attemptId);
    // Deleted on collection so the same paper can never be submitted twice —
    // that is what makes "one chance" true rather than merely intended.
    this.openAttempts.delete(attemptId);
    return attempt;
  }

  async save(result) {
    await this.pool.query(
      `INSERT INTO exam_attempts
         (id, email, name, attempt_no, score, correct, total, passed, perfect, unanswered,
          answers, duration_seconds, started_at, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        result.attemptId, result.email, result.name, result.attemptNo, result.score,
        result.correct, result.total, result.passed, result.perfect, result.unanswered,
        JSON.stringify(result.answers), result.durationSeconds, result.startedAt, result.submittedAt,
      ]
    );
  }

  async attemptsFor(email) {
    const r = await this.pool.query(
      `SELECT id, attempt_no, score, correct, total, passed, perfect, unanswered,
              duration_seconds, submitted_at
         FROM exam_attempts WHERE email = $1 ORDER BY attempt_no ASC`,
      [email]
    );
    return r.rows;
  }

  async allAttempts() {
    const r = await this.pool.query(
      `SELECT email, name, attempt_no, score, passed, perfect, correct, total,
              duration_seconds, submitted_at
         FROM exam_attempts ORDER BY email ASC, attempt_no ASC`
    );
    return r.rows;
  }

  /** Which questions trip people up most — straight from the marked papers. */
  async questionDifficulty() {
    const r = await this.pool.query(`
      SELECT a->>'id'          AS id,
             a->>'module_id'   AS module_id,
             max(a->>'question') AS question,
             count(*)::int     AS asked,
             sum(CASE WHEN (a->>'correct')::boolean THEN 1 ELSE 0 END)::int AS correct
        FROM exam_attempts, jsonb_array_elements(answers) AS a
       GROUP BY a->>'id', a->>'module_id'
       ORDER BY (sum(CASE WHEN (a->>'correct')::boolean THEN 1 ELSE 0 END)::float / count(*)) ASC
    `);
    return r.rows.map(row => ({
      ...row,
      passRate: row.asked ? Math.round((row.correct / row.asked) * 100) : 0,
    }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LearnerExamHistory — what one person's attempts add up to
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The CEO's question — "how many times did it take this employee to score 100%?"
 * — is not a property of any single sitting. It only exists across all of them,
 * so it gets its own object rather than being computed ad hoc in a route.
 */
class LearnerExamHistory {
  constructor(email, name, attempts) {
    this.email = email;
    this.name = name || '';
    this.attempts = [...attempts].sort((a, b) => a.attempt_no - b.attempt_no);
  }

  get totalAttempts() { return this.attempts.length; }
  get bestScore() { return this.attempts.reduce((best, a) => Math.max(best, a.score), 0); }
  get latest() { return this.attempts[this.attempts.length - 1] || null; }
  get hasPassed() { return this.attempts.some(a => a.passed); }

  /** Sittings needed to first pass, or null if they haven't yet. */
  get attemptsToPass() {
    const i = this.attempts.findIndex(a => a.passed);
    return i === -1 ? null : this.attempts[i].attempt_no;
  }

  /** Sittings needed to first score 100%, or null if they haven't yet. */
  get attemptsToPerfect() {
    const i = this.attempts.findIndex(a => a.perfect);
    return i === -1 ? null : this.attempts[i].attempt_no;
  }

  toJSON() {
    return {
      email: this.email,
      name: this.name,
      totalAttempts: this.totalAttempts,
      bestScore: this.bestScore,
      hasPassed: this.hasPassed,
      attemptsToPass: this.attemptsToPass,
      attemptsToPerfect: this.attemptsToPerfect,
      lastAttemptAt: this.latest ? this.latest.submitted_at : null,
      scores: this.attempts.map(a => a.score),
    };
  }

  /** Group a flat list of rows into one history per person. */
  static fromRows(rows) {
    const byEmail = new Map();
    for (const row of rows) {
      if (!byEmail.has(row.email)) byEmail.set(row.email, { name: row.name, attempts: [] });
      const entry = byEmail.get(row.email);
      if (row.name) entry.name = row.name;
      entry.attempts.push(row);
    }
    return [...byEmail.entries()].map(([email, e]) => new LearnerExamHistory(email, e.name, e.attempts));
  }
}

// Fisher-Yates, on a copy — a sort that shuffles is a common bug, and mutating
// the caller's array is a rude surprise.
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { ExamBlueprint, ExamAttempt, ExamRepository, LearnerExamHistory };
