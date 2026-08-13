/**
 * Narrator rotation.
 *
 * Five voices instead of one, rotated across chapters so a learner sitting the
 * whole course isn't listening to the same narrator for two hours. All five are
 * ElevenLabs voices tagged for instructional delivery, mixed in gender and accent.
 *
 * ─── Why the voice is part of the audio filename ─────────────────────────────
 * Pre-generated narration is stored as sha256 of the slide text, so editing a
 * slide changes its hash and the old audio falls out of use automatically. With
 * one narrator that was enough. With five, two chapters holding the SAME text in
 * DIFFERENT voices would hash to the same filename and collide — one chapter would
 * silently play the other's narrator.
 *
 * So the hash covers the voice as well as the text. Change either and you get a
 * new file. This matches how the server's own narration cache has always keyed
 * its entries (`voiceId:text`).
 */

// The rotation, in order. Chapters are assigned round-robin over this list.
const VOICES = [
  { key: 'alice',   id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',   note: 'British, clear and engaging educator' },
  { key: 'matilda', id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', note: 'American, knowledgeable and professional' },
  { key: 'daniel',  id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',  note: 'British, steady broadcaster' },
  { key: 'bella',   id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella',   note: 'American, professional, bright and warm' },
  { key: 'lily',    id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',    note: 'British, velvety and measured' },
];

/**
 * Pinned assignments, so a chapter keeps its narrator even when the course is
 * reordered or a chapter is added. Anything not pinned falls back to round-robin
 * over the module's position, which keeps neighbouring chapters sounding different.
 *
 * Fill this in as the consolidated course settles — an unpinned course still
 * rotates sensibly, it just isn't stable against reordering.
 */
const PINNED = {
  // 'introduction': 'alice',
};

const byKey = Object.fromEntries(VOICES.map(v => [v.key, v]));

/**
 * Which voice narrates this chapter.
 * @param {string} moduleId
 * @param {number} index  position of the module in the course
 */
function voiceForModule(moduleId, index = 0) {
  const pinned = PINNED[moduleId];
  if (pinned && byKey[pinned]) return byKey[pinned];
  return VOICES[index % VOICES.length];
}

/** Every voice in the rotation, for admin display. */
function allVoices() {
  return VOICES.map(v => ({ ...v }));
}

module.exports = { VOICES, PINNED, voiceForModule, allVoices };
