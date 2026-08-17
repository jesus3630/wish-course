/**
 * Graded quizzes.
 *
 * One quiz per part of the training, taken at the end of that part. A learner
 * who stops halfway is only ever tested on what they actually worked through,
 * which is why this is per-part rather than one exam at the end.
 *
 * A sitting is still one pass: every question answered once, no second look, no
 * answer revealed until it is submitted and marked. 70% passes. Every sitting is
 * recorded so we can see how many attempts each person needed to reach 100% on
 * each part.
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
  constructor({ passMark = 70, maxQuestions = 25, minQuestions = 1 } = {}) {
    this.passMark = passMark;
    // A part's quiz asks everything that part has, up to a ceiling. Parts hold
    // anywhere from 4 to 15 questions, so there is no fixed count to enforce —
    // trimming a 5-question part down to a target would just lose coverage.
    this.maxQuestions = maxQuestions;
    this.minQuestions = minQuestions;
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
   * Draw the quiz for one part of the training.
   *
   * Everything that part has, shuffled, capped at `maxQuestions`. Only questions
   * belonging to this part are eligible — testing somebody on material they have
   * not reached yet is the thing this format exists to avoid.
   *
   * @param {Object} bank      { moduleId: [question, ...] }
   * @param {string} moduleId  the part being tested
   * @returns {Array} questions, each tagged with the part it came from
   */
  drawQuestions(bank, moduleId) {
    const questions = (bank[moduleId] || [])
      .filter(q => Array.isArray(q.options) && q.options.length > 1)
      .map(q => ({ ...q, module_id: moduleId }));
    return shuffle(questions).slice(0, this.maxQuestions);
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
  constructor({ id, email, name, moduleId, questions, attemptNo, startedAt }) {
    this.id = id || crypto.randomUUID();
    this.email = email;
    this.name = name || '';
    this.moduleId = moduleId;
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
      moduleId: this.moduleId,
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
      ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS module_id TEXT;
      CREATE INDEX IF NOT EXISTS exam_attempts_email_idx ON exam_attempts (email);
      CREATE INDEX IF NOT EXISTS exam_attempts_email_module_idx ON exam_attempts (email, module_id);
    `);
  }

  /**
   * How many sittings this person has already submitted for this part.
   * Attempts are counted per part, so "attempt 3" means the third go at THIS
   * quiz, not the third quiz they have sat overall.
   */
  async attemptCount(email, moduleId) {
    const r = await this.pool.query(
      'SELECT COUNT(*)::int AS n FROM exam_attempts WHERE email = $1 AND module_id = $2',
      [email, moduleId]
    );
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
         (id, email, name, module_id, attempt_no, score, correct, total, passed, perfect,
          unanswered, answers, duration_seconds, started_at, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        result.attemptId, result.email, result.name, result.moduleId, result.attemptNo,
        result.score, result.correct, result.total, result.passed, result.perfect,
        result.unanswered, JSON.stringify(result.answers), result.durationSeconds,
        result.startedAt, result.submittedAt,
      ]
    );
  }

  async attemptsFor(email, moduleId) {
    const params = moduleId ? [email, moduleId] : [email];
    const r = await this.pool.query(
      `SELECT id, module_id, attempt_no, score, correct, total, passed, perfect, unanswered,
              duration_seconds, submitted_at
         FROM exam_attempts
        WHERE email = $1 ${moduleId ? 'AND module_id = $2' : ''}
        ORDER BY module_id ASC, attempt_no ASC`,
      params
    );
    return r.rows;
  }

  async allAttempts() {
    const r = await this.pool.query(
      `SELECT email, name, module_id, attempt_no, score, passed, perfect, correct, total,
              duration_seconds, submitted_at
         FROM exam_attempts ORDER BY email ASC, module_id ASC, attempt_no ASC`
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
 * "How many times did it take this employee to score 100%?" is not a property of
 * any single sitting — it only exists across all of them, so it gets its own
 * object rather than being computed ad hoc in a route.
 *
 * One of these represents one person's attempts at ONE part of the training.
 * Somebody who never reaches part 9 simply has no history for part 9, which is
 * the point of testing per part: you are only ever measured on what you covered.
 */
class LearnerExamHistory {
  constructor(email, name, attempts, moduleId = null) {
    this.email = email;
    this.name = name || '';
    this.moduleId = moduleId;
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
      moduleId: this.moduleId,
      totalAttempts: this.totalAttempts,
      bestScore: this.bestScore,
      hasPassed: this.hasPassed,
      attemptsToPass: this.attemptsToPass,
      attemptsToPerfect: this.attemptsToPerfect,
      lastAttemptAt: this.latest ? this.latest.submitted_at : null,
      scores: this.attempts.map(a => a.score),
    };
  }

  /** Group a flat list of rows into one history per person PER PART. */
  static fromRows(rows) {
    const byKey = new Map();
    for (const row of rows) {
      const key = `${row.email}::${row.module_id || ''}`;
      if (!byKey.has(key)) {
        byKey.set(key, { email: row.email, moduleId: row.module_id, name: row.name, attempts: [] });
      }
      const entry = byKey.get(key);
      if (row.name) entry.name = row.name;
      entry.attempts.push(row);
    }
    return [...byKey.values()].map(e => new LearnerExamHistory(e.email, e.name, e.attempts, e.moduleId));
  }

  /**
   * Roll several per-part histories up into one line per person — how much of
   * the training they have been tested on, and how they did across it.
   */
  static summarisePerLearner(histories) {
    const byEmail = new Map();
    for (const h of histories) {
      if (!byEmail.has(h.email)) byEmail.set(h.email, { email: h.email, name: h.name, parts: [] });
      const entry = byEmail.get(h.email);
      if (h.name) entry.name = h.name;
      entry.parts.push(h.toJSON());
    }
    return [...byEmail.values()].map(e => {
      const perfect = e.parts.filter(p => p.attemptsToPerfect !== null);
      return {
        email: e.email,
        name: e.name,
        partsAttempted: e.parts.length,
        partsPassed: e.parts.filter(p => p.hasPassed).length,
        partsPerfect: perfect.length,
        totalAttempts: e.parts.reduce((n, p) => n + p.totalAttempts, 0),
        // Averaged over the parts they actually reached 100% on
        averageAttemptsToPerfect: perfect.length
          ? Math.round((perfect.reduce((n, p) => n + p.attemptsToPerfect, 0) / perfect.length) * 10) / 10
          : null,
        lastAttemptAt: e.parts.map(p => p.lastAttemptAt).filter(Boolean).sort().pop() || null,
        parts: e.parts.sort((a, b) => (a.moduleId || '').localeCompare(b.moduleId || '')),
      };
    });
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
