// App version and release notes, shown on the setup screen and the
// "What's New" screen. Bump APP_VERSION and add an entry (newest first)
// whenever a change is worth telling a returning player about.

const APP_VERSION = '0.6.0';

const RELEASE_NOTES = [
  {
    version: '0.6.0',
    date: '2026-08-27',
    notes: [
      'Added a version number and this What’s New screen, so you can see what changed.',
    ],
  },
  {
    version: '0.5.1',
    date: '2026-08-27',
    notes: [
      'Fixed the computer opponent not knowing when to pass — it could keep playing into its own territory at the end of a settled game instead of ending it.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-27',
    notes: [
      'Added a computer opponent as an alternative to local two-player.',
      'Choose your colour, and set a handicap (2–9 stones) for a fairer match against a stronger side.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-08-27',
    notes: [
      'The app can now be installed to your home screen for a real app icon and fullscreen play.',
      'Works fully offline once installed.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-08-27',
    notes: [
      'Added Learn to Play: a full interactive tutorial, from the rules through to advanced tactics.',
      '47 lessons across 8 modules, mixing guided walkthroughs with hands-on practice puzzles.',
      'Your progress through the lessons is saved automatically.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08-27',
    notes: [
      'Switched to Japanese-style territory scoring (territory + prisoners + komi).',
      'Added a live score estimate you can check at any point during play, with territory shading on the board.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-08-27',
    notes: [
      'First release: local two-player Go on a 9×9, 13×13, or 19×19 board.',
      'Full rules — captures, suicide prevention, ko — with undo, pass, and resign.',
      'A mobile-first board that fits any phone screen.',
    ],
  },
];
