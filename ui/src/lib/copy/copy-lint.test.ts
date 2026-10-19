// Copy lint over user-visible strings only (brief 5.7 rules 1 and 2, ported
// from Pry). Every `.svelte` file plus the `.ts` copy files in COPY_FILES.
import { describe, expect, it } from 'vitest';
import { COPY_FILES, allFiles, visible } from './copy-files';

/**
 * `banned_example_names` from the brad-voice skill's lint_rules.json (copied 2026-10-12).
 * Stock names that read as AI-generated examples. Kept verbatim from Pry (brief 5.5).
 */
export const BANNED_EXAMPLE_NAMES = [
  'Aaron',
  'Abara',
  'Abdul',
  'Adaeze',
  'Adeyemi',
  'Aisha',
  'Alvarado',
  'Amara',
  'Andre',
  'Anouk',
  'Ansel',
  'Ashcroft',
  'Astrid',
  'Baptiste',
  'Beaumont',
  'Bennett',
  'Berkowitz',
  'Bethany',
  'Bhatt',
  'Bianca',
  'Bianchi',
  'Blake',
  'Blythe',
  'Boyd',
  'Brenner',
  'Brooks',
  'Bryce',
  'Callahan',
  'Camila',
  'Carmen',
  'Castillo',
  'Chandra',
  'Chao',
  'Clara',
  'Clarke',
  'Cole',
  'Coleman',
  'Colette',
  'Cross',
  'Cruz',
  'Curtis',
  'Cyrus',
  'Damon',
  'Darius',
  'Delgado',
  'Delphine',
  'Desai',
  'Desmond',
  'Devon',
  'Dominic',
  'Donovan',
  'Dubois',
  'Elena',
  'Elias',
  'Ellison',
  'Emmanuel',
  'Esposito',
  'Ezra',
  'Faraday',
  'Farah',
  'Farooqi',
  'Feldman',
  'Felix',
  'Fernando',
  'Fischer',
  'Fletcher',
  'Frances',
  'Freeman',
  'Fuentes',
  'Gallagher',
  'Garrett',
  'Genevieve',
  'Gideon',
  'Gloria',
  'Grant',
  'Haddad',
  'Hannah',
  'Hargrove',
  'Hartman',
  'Hector',
  'Heidi',
  'Holloway',
  'Holt',
  'Hugo',
  'Iglesias',
  'Imani',
  'Ingram',
  'Ingrid',
  'Isaac',
  'Johnson',
  'Jonah',
  'Julian',
  'Kai',
  'Kaminski',
  'Kenji',
  'Kowalski',
  'Kwon',
  'Larsson',
  'Laurent',
  'Leah',
  'Lin',
  'Lindqvist',
  'Lorenzo',
  'Lucas',
  'Lucia',
  'Mahoney',
  'Malcolm',
  'Malik',
  'Marcus',
  'Margot',
  'Marlene',
  'Marsh',
  'McKenna',
  'Mei',
  'Mendez',
  'Mensah',
  'Meredith',
  'Merrick',
  'Moreau',
  'Nadia',
  'Nair',
  'Nakamura',
  'Naomi',
  'Nasser',
  'Nathan',
  'Nguyen',
  'Noor',
  'Nordmann',
  'Novak',
  'Odette',
  'Okafor',
  'Omar',
  'Ortega',
  'Oscar',
  'Osei',
  'Pace',
  'Petit',
  'Petrov',
  'Piper',
  'Priya',
  'Pruitt',
  'Quinn',
  'Rahman',
  'Rahul',
  'Rashida',
  'Ravenna',
  'Reed',
  'Renata',
  'Reyes',
  'Roland',
  'Romano',
  'Rory',
  'Rosa',
  'Roux',
  'Russo',
  'Sasha',
  'Sean',
  'Selena',
  'Siddiqui',
  'Silva',
  'Simon',
  'Sinclair',
  'Sofia',
  'Sterling',
  'Sternberg',
  'Sutton',
  'Talia',
  'Tamsin',
  'Tanaka',
  'Tanvi',
  'Terrence',
  'Theo',
  'Thompson',
  'Trevor',
  'Valentina',
  'Vance',
  'Vanessa',
  'Vasquez',
  'Vaughn',
  'Vincent',
  'Visser',
  'Volkov',
  'Watanabe',
  'Wesley',
  'Whitaker',
  'Whitfield',
  'Whitlock',
  'Willa',
  'Winifred',
  'Wray',
  'Xavier',
  'Yang',
  'Yara',
  'Yuki',
  'Zoe',
];

/** Wrong spellings of names (brief 5.7 rule 3: Hugging Face is two words). */
const BANNED_SPELLINGS = ['HuggingFace'];

const bannedRe = new RegExp(`\\b(${[...BANNED_EXAMPLE_NAMES, ...BANNED_SPELLINGS].join('|')})\\b`);

/** The em dash, written as an escape so this file never holds one (brief 5.7 rule 1). */
const EM_DASH = '\u2014';

/**
 * Lower bound on the files the lint reads, so a broken walk cannot pass by
 * linting nothing (plan F2: replaces Pry's literal 40). T11 sets it to 20;
 * T35 raises it to 80.
 */
export const MIN_LINT_FILES = 80;

const lintFiles = [...allFiles().filter((f) => f.endsWith('.svelte')), ...COPY_FILES].sort();

function perFile(name: string, check: (strings: string[], file: string) => void) {
  describe(name, () => {
    for (const f of lintFiles) it(f, () => check(visible(f), f));
  });
}

describe('copy lint', () => {
  it('lints every .svelte file and every copy file', () => {
    expect(lintFiles.length).toBeGreaterThan(MIN_LINT_FILES);
    expect(lintFiles).toContain('routes/+page.svelte');
    for (const f of COPY_FILES) expect(lintFiles).toContain(f);
  });

  perFile('no em dash in user-visible strings', (strings, f) => {
    expect(
      strings.filter((s) => s.includes(EM_DASH)),
      f,
    ).toEqual([]);
  });

  perFile('banned names', (strings, f) => {
    expect(
      strings.filter((s) => bannedRe.test(s)),
      f,
    ).toEqual([]);
  });
});
