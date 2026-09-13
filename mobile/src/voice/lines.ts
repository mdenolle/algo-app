// Algo's fixed lines. Each id is what a recorded clip is filed under (tier 1),
// so this file doubles as the recording script: read every value aloud once.
// Build steps and hints are spoken from App.tsx's builds with ids
// `${buildId}-step-${n}` and `${buildId}-hint-${n}`.
export const LINES = {
  greeting: 'Hi! I’m Algo. Let’s build something amazing!',
  'joke-question': 'Pourquoi les briques sont-elles heureuses?',
  'joke-answer-fr': 'Parce qu’elles s’emboîtent bien!',
  'joke-answer-en': 'That means: because they fit together well!',
  'ideas-demo': 'Here are three things we can build!',
  'new-ideas': 'Voilà! Three new ideas!',
  'scan-looking': 'Let me look at your pieces.',
  complete: 'Bravo! Magnifique! You built it!',
  'invention-complete': 'Bravo! Your invention is one of a kind!',
  'book-ready': 'Your real instruction book is ready. Let’s turn the pages!',
  'creator-welcome': 'I can’t wait to see what you invent!',
} as const;

export type LineId = keyof typeof LINES;
