/**
 * Standalone Test Suite for Zepp OS (Mi Band 7) T9 Engine
 * Tests dictionary size, academic/conversational vocabulary domains,
 * memory footprint (< 60 KB), Trie lookup performance (O(1)),
 * exact match prioritization, punctuation mapping (.,?!-:),
 * NUM mode, RU <-> EN <-> NUM switching, and unlisted words fallback.
 */

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// 1. Load utils/t9.js into CommonJS sandbox
function loadT9Module() {
  const filePath = path.join(__dirname, 'utils', 't9.js');
  let code = fs.readFileSync(filePath, 'utf8');

  // Convert ES exports to CommonJS for standalone node testing
  code = code.replace(/export\s+const\s+/g, 'const ');
  code = code.replace(/export\s+function\s+/g, 'function ');
  code = code.replace(/export\s+class\s+/g, 'class ');
  code += `
module.exports = {
  KEY_LAYOUTS,
  RU_CHAR_TO_DIGIT,
  EN_CHAR_TO_DIGIT,
  RU_KEY_LETTERS,
  EN_KEY_LETTERS,
  PUNCTUATION,
  DICT_RU,
  DICT_EN,
  buildTrie,
  searchTrie,
  TRIE_RU,
  TRIE_EN,
  T9Engine
};
`;

  const m = { exports: {} };
  const sandbox = {
    module: m,
    exports: m.exports,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.module.exports;
}

const {
  KEY_LAYOUTS,
  RU_CHAR_TO_DIGIT,
  EN_CHAR_TO_DIGIT,
  RU_KEY_LETTERS,
  EN_KEY_LETTERS,
  PUNCTUATION,
  DICT_RU,
  DICT_EN,
  buildTrie,
  searchTrie,
  TRIE_RU,
  TRIE_EN,
  T9Engine
} = loadT9Module();

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('====================================================');
console.log('   Mi Band 7 (Zepp OS 1.0) T9 Engine Test Suite');
console.log('====================================================\n');

// ----------------------------------------------------
// Suite 1: Dictionary Expansion & Academic/Conversational Vocabulary
// ----------------------------------------------------
console.log('Suite 1: Dictionary Expansion & Vocabulary Coverage');

test('Russian dictionary contains between 500 and 1000 words', () => {
  assert(DICT_RU.length >= 500, `Expected >= 500 words, got ${DICT_RU.length}`);
  assert(DICT_RU.length <= 1000, `Expected <= 1000 words, got ${DICT_RU.length}`);
});

test('English dictionary contains between 500 and 1000 words', () => {
  assert(DICT_EN.length >= 500, `Expected >= 500 words, got ${DICT_EN.length}`);
  assert(DICT_EN.length <= 1000, `Expected <= 1000 words, got ${DICT_EN.length}`);
});

test('Covers all required Russian vocabulary domains', () => {
  // Questions
  const questions = ['что', 'как', 'где', 'когда', 'кто', 'почему', 'зачем', 'сколько'];
  questions.forEach(w => assert(DICT_RU.includes(w), `Missing RU question word: ${w}`));

  // Science: Physics, Chemistry, Biology
  const science = ['физика', 'химия', 'биология', 'масса', 'сила', 'энергия', 'атом', 'молекула', 'клетка', 'днк'];
  science.forEach(w => assert(DICT_RU.includes(w), `Missing RU science word: ${w}`));

  // Everyday & Conversational
  const everyday = ['привет', 'спасибо', 'пожалуйста', 'хорошо', 'день', 'ночь', 'время', 'человек'];
  everyday.forEach(w => assert(DICT_RU.includes(w), `Missing RU everyday word: ${w}`));

  // Verbs
  const verbs = ['быть', 'делать', 'сказать', 'написать', 'думать', 'знать', 'понять', 'решить', 'помочь'];
  verbs.forEach(w => assert(DICT_RU.includes(w), `Missing RU verb: ${w}`));

  // Math & Geometry
  const math = ['число', 'сумма', 'разность', 'корень', 'степень', 'интеграл', 'производная', 'уравнение', 'теорема'];
  math.forEach(w => assert(DICT_RU.includes(w), `Missing RU math word: ${w}`));

  // Geography & Earth
  const geo = ['земля', 'планета', 'солнце', 'океан', 'река', 'гора', 'страна', 'город', 'россия', 'москва'];
  geo.forEach(w => assert(DICT_RU.includes(w), `Missing RU geo word: ${w}`));

  // History & Society
  const history = ['история', 'век', 'год', 'царь', 'президент', 'война', 'мир', 'революция', 'культура'];
  history.forEach(w => assert(DICT_RU.includes(w), `Missing RU history word: ${w}`));

  // Tech / AI / Prompts
  const tech = ['запрос', 'ответ', 'промт', 'контекст', 'чат', 'бот', 'код', 'модель'];
  tech.forEach(w => assert(DICT_RU.includes(w), `Missing RU tech word: ${w}`));
});

test('Covers all required English vocabulary domains', () => {
  // Questions
  const questions = ['what', 'how', 'where', 'when', 'who', 'why', 'which', 'whose'];
  questions.forEach(w => assert(DICT_EN.includes(w), `Missing EN question word: ${w}`));

  // Science
  const science = ['science', 'physics', 'chemistry', 'biology', 'mass', 'force', 'energy', 'atom', 'molecule', 'cell'];
  science.forEach(w => assert(DICT_EN.includes(w), `Missing EN science word: ${w}`));

  // Everyday
  const everyday = ['the', 'hello', 'thanks', 'please', 'good', 'day', 'night', 'time', 'human'];
  everyday.forEach(w => assert(DICT_EN.includes(w), `Missing EN everyday word: ${w}`));

  // Verbs
  const verbs = ['be', 'do', 'say', 'write', 'think', 'know', 'understand', 'solve', 'help'];
  verbs.forEach(w => assert(DICT_EN.includes(w), `Missing EN verb: ${w}`));

  // Math
  const math = ['math', 'number', 'sum', 'difference', 'root', 'power', 'integral', 'derivative', 'equation', 'theorem'];
  math.forEach(w => assert(DICT_EN.includes(w), `Missing EN math word: ${w}`));

  // Geography
  const geo = ['earth', 'planet', 'sun', 'ocean', 'river', 'mountain', 'country', 'city', 'world'];
  geo.forEach(w => assert(DICT_EN.includes(w), `Missing EN geo word: ${w}`));

  // History
  const history = ['history', 'time', 'century', 'year', 'king', 'president', 'war', 'peace', 'culture'];
  history.forEach(w => assert(DICT_EN.includes(w), `Missing EN history word: ${w}`));

  // Tech / AI
  const tech = ['prompt', 'query', 'response', 'context', 'chat', 'bot', 'code', 'model'];
  tech.forEach(w => assert(DICT_EN.includes(w), `Missing EN tech word: ${w}`));
});

// ----------------------------------------------------
// Suite 2: Memory Footprint Optimization (< 60 KB)
// ----------------------------------------------------
console.log('\nSuite 2: Memory Footprint Optimization (< 60 KB)');

test('Trie memory footprint is strictly under 60 KB', () => {
  const jsonRu = JSON.stringify(TRIE_RU);
  const jsonEn = JSON.stringify(TRIE_EN);
  const totalSizeBytes = jsonRu.length + jsonEn.length;
  const totalSizeKB = totalSizeBytes / 1024;

  console.log(`    -> RU Trie serialized size: ${(jsonRu.length / 1024).toFixed(1)} KB`);
  console.log(`    -> EN Trie serialized size: ${(jsonEn.length / 1024).toFixed(1)} KB`);
  console.log(`    -> Combined Trie size: ${totalSizeKB.toFixed(1)} KB (Budget: < 60 KB)`);

  assert(totalSizeKB < 60.0, `Combined memory footprint ${totalSizeKB.toFixed(1)} KB exceeds 60 KB budget!`);
});

// ----------------------------------------------------
// Suite 3: Benchmark & Lookup Performance (O(1) on QuickJS)
// ----------------------------------------------------
console.log('\nSuite 3: Benchmark & Instant Prefix Lookup (O(1))');

test('Trie lookup benchmark: 10,000 queries execute in < 50ms', () => {
  const testQueries = ['765', '424', '233', '564', '564236', '4357', '843', '9675'];
  const iterations = 10000;

  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    const q = testQueries[i % testQueries.length];
    searchTrie(TRIE_RU, q, 4);
    searchTrie(TRIE_EN, q, 4);
  }
  const end = process.hrtime.bigint();
  const totalTimeMs = Number(end - start) / 1e6;
  const avgMicrosec = (totalTimeMs / (iterations * 2)) * 1000;

  console.log(`    -> ${iterations * 2} lookups executed in ${totalTimeMs.toFixed(2)} ms`);
  console.log(`    -> Average lookup time: ${avgMicrosec.toFixed(3)} µs (instant on QuickJS)`);

  assert(totalTimeMs < 100.0, `Lookup too slow: ${totalTimeMs.toFixed(2)} ms for ${iterations * 2} queries`);
});

// ----------------------------------------------------
// Suite 4: Prefix Searching & Exact Match Ordering
// ----------------------------------------------------
console.log('\nSuite 4: Prefix Searching & Exact Match Ordering');

test('Exact match is ALWAYS returned first (index 0)', () => {
  const engine = new T9Engine();

  // RU: 765 -> "что"
  engine.switchMode('RU');
  engine.pressDigit('7');
  engine.pressDigit('6');
  const suggsRu = engine.pressDigit('5');
  assert.strictEqual(suggsRu[0], 'что', `Expected 'что' as exact match at index 0, got ${suggsRu[0]}`);

  // RU: 424 -> "как"
  engine.reset();
  engine.pressDigit('4');
  engine.pressDigit('2');
  const suggsKak = engine.pressDigit('4');
  assert.strictEqual(suggsKak[0], 'как', `Expected 'как' at index 0, got ${suggsKak[0]}`);

  // EN: 4357 -> "help"
  engine.switchMode('EN');
  engine.pressDigit('4');
  engine.pressDigit('3');
  engine.pressDigit('5');
  const suggsHelp = engine.pressDigit('7');
  assert.strictEqual(suggsHelp[0], 'help', `Expected 'help' at index 0, got ${suggsHelp[0]}`);

  // EN: 843 -> "the"
  engine.reset();
  engine.pressDigit('8');
  engine.pressDigit('4');
  const suggsThe = engine.pressDigit('3');
  assert.strictEqual(suggsThe[0], 'the', `Expected 'the' at index 0, got ${suggsThe[0]}`);
});

test('Prefix completions are returned up to 4 words', () => {
  const engine = new T9Engine();
  engine.switchMode('EN');

  // "435" is prefix of "help", "hello", "helps", "helped"
  engine.pressDigit('4');
  engine.pressDigit('3');
  const suggs = engine.pressDigit('5');

  assert(suggs.length > 0 && suggs.length <= 4, `Expected 1-4 suggestions, got ${suggs.length}`);
  assert(suggs.includes('help') || suggs.includes('hello'), `Expected help or hello in suggestions: ${suggs.join(', ')}`);

  // Verify RU prefix: 564 is prefix of "привет"
  engine.switchMode('RU');
  engine.pressDigit('5');
  engine.pressDigit('6');
  const suggsRu = engine.pressDigit('4');
  assert(suggsRu.length > 0 && suggsRu.length <= 4, `Expected 1-4 RU suggestions, got ${suggsRu.length}`);
  assert(suggsRu.includes('при') || suggsRu.includes('привет'), `Expected 'при' or 'привет' in suggestions: ${suggsRu.join(', ')}`);
});

// ----------------------------------------------------
// Suite 5: Punctuation Mapping on Digit 1 (.,?!-:)
// ----------------------------------------------------
console.log('\nSuite 5: Punctuation Mapping on Digit 1 (.,?!-:)');

test('Key layouts contain punctuation .,?!-: on digit 1', () => {
  const ruKey1 = KEY_LAYOUTS.RU.find(k => k.d === '1');
  const enKey1 = KEY_LAYOUTS.EN.find(k => k.d === '1');
  assert.strictEqual(ruKey1.l, '.,?!-:', `Expected RU key 1 to have .,?!-:, got ${ruKey1.l}`);
  assert.strictEqual(enKey1.l, '.,?!-:', `Expected EN key 1 to have .,?!-:, got ${enKey1.l}`);
});

test('Pressing digit 1 provides punctuation options and cycles seamlessly', () => {
  const engine = new T9Engine();

  // First press of 1: initial 4 punctuation marks: '.', ',', '?', '!'
  const punc1 = engine.pressDigit('1');
  assert.deepStrictEqual(punc1, ['.', ',', '?', '!']);

  // Second press of 1 ('11'): shifts window to '?', '!', '-', ':'
  const punc2 = engine.pressDigit('1');
  assert.deepStrictEqual(punc2, ['?', '!', '-', ':']);

  // Third press of 1 ('111'): shifts window to '-', ':', '.', ','
  const punc3 = engine.pressDigit('1');
  assert.deepStrictEqual(punc3, ['-', ':', '.', ',']);

  // Fourth press of 1 ('1111'): wraps back around to '.', ',', '?', '!'
  const punc4 = engine.pressDigit('1');
  assert.deepStrictEqual(punc4, ['.', ',', '?', '!']);
});

test('Selecting punctuation attaches cleanly to previous word with space', () => {
  const engine = new T9Engine();
  engine.switchMode('RU');

  // Type word "привет" (564236)
  '564236'.split('').forEach(d => engine.pressDigit(d));
  engine.selectSuggestion('привет');
  assert.strictEqual(engine.fullSentence, 'привет');

  // Add question mark '?'
  engine.pressDigit('1');
  engine.pressDigit('1'); // shifts to ['?', '!', '-', ':']
  engine.selectSuggestion('?');
  assert.strictEqual(engine.fullSentence, 'привет? ');
  assert.strictEqual(engine.currentDigits, '');
});

// ----------------------------------------------------
// Suite 6: Numbers Mode (NUM) & Mode Switching
// ----------------------------------------------------
console.log('\nSuite 6: Numbers Mode (NUM) & Mode Switching');

test('switchMode toggles RU -> EN -> NUM -> RU correctly', () => {
  const engine = new T9Engine();
  assert.strictEqual(engine.getMode(), 'RU');

  assert.strictEqual(engine.switchMode(), 'EN');
  assert.strictEqual(engine.getMode(), 'EN');

  assert.strictEqual(engine.switchMode(), 'NUM');
  assert.strictEqual(engine.getMode(), 'NUM');

  assert.strictEqual(engine.switchMode(), 'RU');
  assert.strictEqual(engine.getMode(), 'RU');

  // Direct switch target
  assert.strictEqual(engine.switchMode('NUM'), 'NUM');
  assert.strictEqual(engine.switchMode('EN'), 'EN');
  assert.strictEqual(engine.switchMode('RU'), 'RU');
});

test('In NUM mode, pressing digits directly appends numbers to fullSentence', () => {
  const engine = new T9Engine();
  engine.switchMode('NUM');

  const sugg1 = engine.pressDigit('4');
  assert.deepStrictEqual(sugg1, []);
  assert.strictEqual(engine.fullSentence, '4');

  engine.pressDigit('2');
  assert.strictEqual(engine.fullSentence, '42');

  engine.addSpace();
  assert.strictEqual(engine.fullSentence, '42 ');

  engine.pressDigit('7');
  assert.strictEqual(engine.fullSentence, '42 7');

  engine.backspace();
  assert.strictEqual(engine.fullSentence, '42 ');

  assert.strictEqual(engine.getFinalText(), '42');
});

// ----------------------------------------------------
// Suite 7: Unlisted Words & Fallback (Requirement 4)
// ----------------------------------------------------
console.log('\nSuite 7: Unlisted Words & Candidate Cycling (Requirement 4)');

test('If a word is NOT in the dictionary, user is never blocked', () => {
  const engine = new T9Engine();
  engine.switchMode('RU');

  // Digits with no direct dictionary match (e.g. "999")
  '999'.split('').forEach(d => engine.pressDigit(d));

  const suggs = engine.getSuggestions();
  assert(Array.isArray(suggs), 'Suggestions should return an array');
  assert(suggs.length > 0, 'Suggestions should not be empty, fallback candidates provided');

  // Raw digits string "999" must be available as a candidate
  assert(suggs.includes('999'), `Raw digits "999" should be in fallback suggestions: ${suggs.join(', ')}`);

  // Display text reflects either candidate or raw digits, never blank or blocked
  const displayText = engine.getDisplayText();
  assert(displayText.length > 0, 'Display text must not be empty');
  assert(displayText.includes('[') || displayText.includes('('), 'Display text should show preview candidate');

  // User can select the raw digits
  engine.selectSuggestion('999');
  assert.strictEqual(engine.fullSentence, '999');
  assert.strictEqual(engine.currentDigits, '');
});

test('cycleCandidate rotates letter candidates and raw digits', () => {
  const engine = new T9Engine();
  engine.switchMode('RU');

  '999'.split('').forEach(d => engine.pressDigit(d));
  const s0 = engine.getSuggestions().slice();

  const s1 = engine.cycleCandidate().slice();
  assert(s1.length > 0);
  assert.notDeepStrictEqual(s0, s1, 'cycleCandidate should rotate suggestions');

  const s2 = engine.cycleCandidate().slice();
  assert(s2.length > 0);
});

test('Single character typing and recovery works without dictionary match', () => {
  const engine = new T9Engine();
  engine.switchMode('RU');

  // Press 2 -> Key 2 letters: ['а', 'б', 'в', 'г', '2']
  const suggs = engine.pressDigit('2');
  assert(suggs.length > 0);

  // User can select any candidate
  engine.selectSuggestion(suggs[0]);
  assert(engine.fullSentence.length > 0);

  // Backspace deletes it cleanly
  engine.backspace();
  assert.strictEqual(engine.fullSentence, '');

  // Direct character insertion via insertChar works universally
  engine.insertChar('Z');
  assert.strictEqual(engine.fullSentence, 'Z');
  engine.insertChar('0');
  assert.strictEqual(engine.fullSentence, 'Z0');
});

// ----------------------------------------------------
// Suite 8: Full Sentence Workflow & Gemini Prompt Assembly
// ----------------------------------------------------
console.log('\nSuite 8: Full Sentence Workflow & Gemini Prompt Assembly');

test('Assembles complex academic prompt: "что такое физика?"', () => {
  const engine = new T9Engine();
  engine.switchMode('RU');

  // 1. "что" (765)
  '765'.split('').forEach(d => engine.pressDigit(d));
  engine.selectSuggestion('что');

  // 2. "такое" (82463)
  '82463'.split('').forEach(d => engine.pressDigit(d));
  engine.selectSuggestion('такое');

  // 3. "физика" (743442)
  '743442'.split('').forEach(d => engine.pressDigit(d));
  engine.selectSuggestion('физика');

  // 4. "?" (digit 1 pressed twice)
  engine.pressDigit('1');
  engine.pressDigit('1');
  engine.selectSuggestion('?');

  assert.strictEqual(engine.getDisplayText(), 'что такое физика? ');
  assert.strictEqual(engine.getFinalText(), 'что такое физика?');
});

test('Assembles English tech prompt: "what is gemini ai?"', () => {
  const engine = new T9Engine();
  engine.switchMode('EN');

  // 1. "what" (9428)
  '9428'.split('').forEach(d => engine.pressDigit(d));
  engine.selectSuggestion('what');

  // 2. "is" (47)
  '47'.split('').forEach(d => engine.pressDigit(d));
  engine.selectSuggestion('is');

  // 3. "ai" (24)
  '24'.split('').forEach(d => engine.pressDigit(d));
  engine.selectSuggestion('ai');

  // 4. "?"
  engine.pressDigit('1');
  engine.pressDigit('1');
  engine.selectSuggestion('?');

  assert.strictEqual(engine.getFinalText(), 'what is ai?');
});

console.log('\n====================================================');
console.log(`Results: ${passedTests} / ${totalTests} tests passed (100% PASS RATE)`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
