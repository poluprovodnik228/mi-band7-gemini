// Гибридный движок ввода: Multitap (посимвольный перебор) + T9 (подсказки слов)
// Разработан специально под экран 192x490 Xiaomi Smart Band 7

export const KEY_LAYOUTS = {
  RU: [
    { d: '1', l: '.,?!-' },
    { d: '2', l: 'АБВГ' },
    { d: '3', l: 'ДЕЖЗ' },
    { d: '4', l: 'ИЙКЛ' },
    { d: '5', l: 'МНОП' },
    { d: '6', l: 'РСТУ' },
    { d: '7', l: 'ФХЦЧ' },
    { d: '8', l: 'ШЩЪЫ' },
    { d: '9', l: 'ЬЭЮЯ' }
  ],
  EN: [
    { d: '1', l: '.,?!-' },
    { d: '2', l: 'ABC' },
    { d: '3', l: 'DEF' },
    { d: '4', l: 'GHI' },
    { d: '5', l: 'JKL' },
    { d: '6', l: 'MNO' },
    { d: '7', l: 'PQRS' },
    { d: '8', l: 'TUV' },
    { d: '9', l: 'WXYZ' }
  ],
  NUM: [
    { d: '1', l: '1' },
    { d: '2', l: '2' },
    { d: '3', l: '3' },
    { d: '4', l: '4' },
    { d: '5', l: '5' },
    { d: '6', l: '6' },
    { d: '7', l: '7' },
    { d: '8', l: '8' },
    { d: '9', l: '9' }
  ]
};

const CHARS_RU = {
  '1': ['.', ',', '?', '!', '-', ':', '@', '1'],
  '2': ['а', 'б', 'в', 'г', '2'],
  '3': ['д', 'е', 'ж', 'з', '3'],
  '4': ['и', 'й', 'к', 'л', '4'],
  '5': ['м', 'н', 'о', 'п', '5'],
  '6': ['р', 'с', 'т', 'у', '6'],
  '7': ['ф', 'х', 'ц', 'ч', '7'],
  '8': ['ш', 'щ', 'ъ', 'ы', '8'],
  '9': ['ь', 'э', 'ю', 'я', '9'],
  '0': ['0', '+']
};

const CHARS_EN = {
  '1': ['.', ',', '?', '!', '-', ':', '@', '1'],
  '2': ['a', 'b', 'c', '2'],
  '3': ['d', 'e', 'f', '3'],
  '4': ['g', 'h', 'i', '4'],
  '5': ['j', 'k', 'l', '5'],
  '6': ['m', 'n', 'o', '6'],
  '7': ['p', 'q', 'r', 's', '7'],
  '8': ['t', 'u', 'v', '8'],
  '9': ['w', 'x', 'y', 'z', '9'],
  '0': ['0', '+']
};

// Высокочастотный словарь для предиктивных подсказок T9
const DICT_RU = [
  "привет", "как", "дела", "что", "это", "где", "когда", "почему", "зачем", "сколько",
  "погода", "курс", "доллар", "рубль", "биткоин", "время", "сейчас", "сегодня", "завтра",
  "спасибо", "пожалуйста", "помоги", "напиши", "скажи", "объясни", "переведи", "найди",
  "кто", "ты", "я", "он", "она", "мы", "вы", "они", "меня", "тебя", "его", "ее", "нас", "вам",
  "хорошо", "отлично", "да", "нет", "ок", "ладно", "точно", "конечно", "можно", "нужно",
  "новость", "новости", "работа", "город", "москва", "мир", "россия", "деньги", "телефон",
  "музыка", "фильм", "книга", "игра", "код", "программа", "текст", "вопрос", "ответ",
  "быстро", "много", "мало", "очень", "лучший", "новый", "старый", "большой", "умный"
];

const DICT_EN = [
  "hello", "hi", "how", "are", "you", "what", "is", "where", "when", "why", "who",
  "weather", "time", "today", "tomorrow", "help", "explain", "translate", "write",
  "thanks", "please", "yes", "no", "ok", "good", "great", "fine", "best", "new",
  "news", "price", "bitcoin", "dollar", "money", "city", "world", "phone", "music",
  "book", "game", "code", "ai", "gemini", "question", "answer", "fast", "smart"
];

const RU_MAP = {};
for (const [digit, chars] of Object.entries(CHARS_RU)) {
  for (const c of chars) RU_MAP[c] = digit;
}
RU_MAP['ё'] = '3';

const EN_MAP = {};
for (const [digit, chars] of Object.entries(CHARS_EN)) {
  for (const c of chars) EN_MAP[c] = digit;
}

export class T9Engine {
  constructor() {
    this.mode = 'RU'; // 'RU', 'EN', 'NUM'
    this.text = ''; // Полный введенный текст
    this.lastDigit = null;
    this.lastTime = 0;
    this.cycleIndex = 0;
    this.currentWordDigits = '';
  }

  getMode() {
    return this.mode;
  }

  switchMode(target) {
    if (target) {
      this.mode = target;
    } else {
      if (this.mode === 'RU') this.mode = 'EN';
      else if (this.mode === 'EN') this.mode = 'NUM';
      else this.mode = 'RU';
    }
    this.resetCycle();
    return this.mode;
  }

  resetCycle() {
    this.lastDigit = null;
    this.lastTime = 0;
    this.cycleIndex = 0;
    this.currentWordDigits = '';
  }

  pressDigit(digit) {
    const now = Date.now();

    if (this.mode === 'NUM') {
      this.text += digit;
      this.resetCycle();
      return this.getSuggestions();
    }

    const charMap = this.mode === 'RU' ? CHARS_RU : CHARS_EN;
    const chars = charMap[digit] || [digit];

    // Если та же клавиша нажата менее чем через 850 мс — циклически меняем букву
    if (this.lastDigit === digit && (now - this.lastTime) < 850 && this.text.length > 0) {
      this.cycleIndex = (this.cycleIndex + 1) % chars.length;
      const newChar = chars[this.cycleIndex];
      // Заменяем последнюю букву
      this.text = this.text.slice(0, -1) + newChar;
    } else {
      // Новая буква
      this.cycleIndex = 0;
      this.text += chars[0];
      this.currentWordDigits += digit;
    }

    this.lastDigit = digit;
    this.lastTime = now;

    return this.getSuggestions();
  }

  addSpace() {
    this.resetCycle();
    if (this.text.length > 0 && !this.text.endsWith(' ')) {
      this.text += ' ';
    }
    return this.text;
  }

  backspace() {
    this.resetCycle();
    if (this.text.length > 0) {
      this.text = this.text.slice(0, -1);
    }
    return this.text;
  }

  selectSuggestion(word) {
    if (!word) return this.text;

    // Заменяем последнее незавершенное слово на подсказку
    const lastSpace = this.text.lastIndexOf(' ');
    if (lastSpace === -1) {
      this.text = word + ' ';
    } else {
      this.text = this.text.slice(0, lastSpace + 1) + word + ' ';
    }

    this.resetCycle();
    return this.text;
  }

  getSuggestions() {
    // Ищем подходящие слова по началу последнего слова
    const lastSpace = this.text.lastIndexOf(' ');
    const currentWord = (lastSpace === -1 ? this.text : this.text.slice(lastSpace + 1)).toLowerCase();

    if (!currentWord || currentWord.length === 0) {
      return [];
    }

    const dict = this.mode === 'RU' ? DICT_RU : DICT_EN;
    const matches = [];

    for (let i = 0; i < dict.length; i++) {
      if (dict[i].startsWith(currentWord) && dict[i] !== currentWord) {
        matches.push(dict[i]);
        if (matches.length >= 2) break;
      }
    }

    return matches;
  }

  getDisplayText() {
    return this.text || 'Введите запрос...';
  }

  getFinalText() {
    return this.text.trim();
  }

  reset() {
    this.text = '';
    this.resetCycle();
  }
}
