export class BibleDB {
  constructor() {
    this.bibleData = null;
    this.dictionaryData = null;
    this.pericopesData = null;
    this.favorites = JSON.parse(localStorage.getItem('bible_favorites') || '[]');
    this.notes = JSON.parse(localStorage.getItem('bible_notes') || '[]');
    this.highlights = JSON.parse(localStorage.getItem('bible_highlights') || '[]');
    const defaults = { last_book: "Génesis", last_chapter: "1", theme: "classic", tts_voice: 0, tts_voice_name: "", skip_verse_numbers: false };
    const stored = JSON.parse(localStorage.getItem('bible_settings') || '{}');
    this.settings = { ...defaults, ...stored };
  }

  async init() {
    try {
      const bResp = await fetch('./bibles_rv1960.json');
      this.bibleData = await bResp.json();
      const dResp = await fetch('./dictionary.json');
      this.dictionaryData = await dResp.json();
      try {
        const pResp = await fetch('./pericopes.json');
        if (pResp.ok) this.pericopesData = await pResp.json();
      } catch (e) { console.warn("Pericopes not found, ignoring."); }
      return true;
    } catch (e) {
      console.error("Error loading bible data:", e);
      return false;
    }
  }

  getBooks(testament = null) {
    if (!this.bibleData) return [];
    // Order based on common biblical order
    const BOOKS_ORDER = [
      "Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio", "Josué", "Jueces", "Rut",
      "1 Samuel", "2 Samuel", "1 Reyes", "2 Reyes", "1 Crónicas", "2 Crónicas", "Esdras", "Nehemías",
      "Ester", "Job", "Salmos", "Proverbios", "Eclesiastés", "Cantares", "Isaías", "Jeremías",
      "Lamentaciones", "Ezequiel", "Daniel", "Oseas", "Joel", "Amós", "Abdías", "Jonás",
      "Miqueas", "Nahúm", "Habacuc", "Sofonías", "Hageo", "Zacarías", "Malaquías",
      "San Mateo", "San Marcos", "San Lucas", "San Juan", "Hechos", "Romanos", "1 Corintios", "2 Corintios",
      "Gálatas", "Efesios", "Filipenses", "Colosenses", "1 Tesalonicenses", "2 Tesalonicenses",
      "1 Timoteo", "2 Timoteo", "Tito", "Filemón", "Hebreos", "Santiago", "1 Pedro", "2 Pedro",
      "1 Juan", "2 Juan", "3 Juan", "Judas", "Apocalipsis"
    ];
    const availableBooks = Object.keys(this.bibleData);
    const ordered = BOOKS_ORDER.filter(b => availableBooks.includes(b));

    if (testament === 'old') return ordered.slice(0, 39);
    if (testament === 'new') return ordered.slice(39);
    return ordered;
  }

  getChapters(bookName) {
    if (!this.bibleData || !this.bibleData[bookName]) return [];
    return Object.keys(this.bibleData[bookName]).sort((a, b) => parseInt(a) - parseInt(b));
  }

  getVerses(bookName, chapterNum) {
    if (!this.bibleData || !this.bibleData[bookName] || !this.bibleData[bookName][chapterNum]) return [];
    const verses = this.bibleData[bookName][chapterNum];
    return Object.entries(verses).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  }

  getPericope(book, chapter, verse) {
    if (!this.pericopesData) return null;

    // 1. Try exact match
    if (this.pericopesData[book] && this.pericopesData[book][chapter]) {
      return this.pericopesData[book][chapter][verse] || null;
    }

    // 2. Normalization for common variations
    let variants = [
      book.replace('San ', 'S. '),
      book.replace('San ', ''),
      book.replace('S. ', ''),
      book.replace('1 ', '1'),
      book.replace('2 ', '2'),
      book.replace('3 ', '3')
    ];

    for (let variant of variants) {
      if (this.pericopesData[variant] && this.pericopesData[variant][chapter]) {
        return this.pericopesData[variant][chapter][verse] || null;
      }
    }

    // 3. Last resort: Case-insensitive match from the keys
    const bookKeys = Object.keys(this.pericopesData);
    const normalizedBook = book.toLowerCase().replace(/[^a-z0-9]/g, '');
    const foundKey = bookKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedBook);

    if (foundKey && this.pericopesData[foundKey][chapter]) {
      return this.pericopesData[foundKey][chapter][verse] || null;
    }

    return null;
  }

  search(query, bookFilter = '') {
    if (!this.bibleData) return [];
    const q = query.toLowerCase();
    const results = [];

    // Optimizacion: Si hay filtro de libro, solo buscamos en ese libro
    const booksToSearch = bookFilter ? { [bookFilter]: this.bibleData[bookFilter] } : this.bibleData;

    for (const [book, chapters] of Object.entries(booksToSearch)) {
      if (!chapters) continue; // Safety check
      for (const [chapter, verses] of Object.entries(chapters)) {
        for (const [vNum, text] of Object.entries(verses)) {
          if (text.toLowerCase().includes(q)) {
            results.push({ book, chapter, vNum, text });
          }
        }
      }
    }
    return results;
  }

  isFavorite(book, chapter, verse) {
    const id = `${book} ${chapter}:${verse}`;
    return this.favorites.some(f => f.id === id);
  }

  toggleFavorite(book, chapter, verse, text) {
    const id = `${book} ${chapter}:${verse}`;
    const index = this.favorites.findIndex(f => f.id === id);
    if (index > -1) {
      this.favorites.splice(index, 1);
    } else {
      this.favorites.push({ id, book, chapter, verse, text, date: new Date().toISOString() });
    }
    localStorage.setItem('bible_favorites', JSON.stringify(this.favorites));
    return index === -1; // returns true if added
  }

  deleteFavorite(index) {
    this.favorites.splice(index, 1);
    localStorage.setItem('bible_favorites', JSON.stringify(this.favorites));
  }

  addNote(book, chapter, verse, text, noteContent) {
    this.notes.push({ book, chapter, verse, text, note: noteContent, date: new Date().toISOString() });
    localStorage.setItem('bible_notes', JSON.stringify(this.notes));
  }

  deleteNote(index) {
    this.notes.splice(index, 1);
    localStorage.setItem('bible_notes', JSON.stringify(this.notes));
  }

  updateNote(index, noteContent) {
    if (this.notes[index]) {
      this.notes[index].note = noteContent;
      this.notes[index].date = new Date().toISOString();
      localStorage.setItem('bible_notes', JSON.stringify(this.notes));
    }
  }

  isHighlighted(book, chapter, verse) {
    const id = `${book} ${chapter}:${verse}`;
    return this.highlights.find(h => h.id === id);
  }

  addHighlight(book, chapter, verse, text, color) {
    const id = `${book} ${chapter}:${verse}`;
    // Remove if exists to update color
    const existingIdx = this.highlights.findIndex(h => h.id === id);
    if (existingIdx > -1) this.highlights.splice(existingIdx, 1);

    this.highlights.push({ id, book, chapter, verse, text, color, date: new Date().toISOString() });
    localStorage.setItem('bible_highlights', JSON.stringify(this.highlights));
  }

  removeHighlight(book, chapter, verse) {
    const id = `${book} ${chapter}:${verse}`;
    const index = this.highlights.findIndex(h => h.id === id);
    if (index > -1) {
      this.highlights.splice(index, 1);
      localStorage.setItem('bible_highlights', JSON.stringify(this.highlights));
    }
  }

  deleteHighlight(index) {
    this.highlights.splice(index, 1);
    localStorage.setItem('bible_highlights', JSON.stringify(this.highlights));
  }

  setLastRead(book, chapter) {
    this.settings.last_book = book;
    this.settings.last_chapter = chapter;
    this.saveSettings();
  }

  setTheme(themeName) {
    this.settings.theme = themeName;
    this.saveSettings();
  }

  saveSettings() {
    localStorage.setItem('bible_settings', JSON.stringify(this.settings));
  }

  searchDictionary(query) {
    if (!this.dictionaryData) return [];
    const q = query.toLowerCase();
    return Object.entries(this.dictionaryData)
      .filter(([term, def]) => term.toLowerCase().includes(q) || def.toLowerCase().includes(q))
      .map(([term, definition]) => ({ term, definition }));
  }

  getRandomVerse() {
    if (!this.bibleData) return null;
    const books = Object.keys(this.bibleData);
    const book = books[Math.floor(Math.random() * books.length)];
    const chapters = Object.keys(this.bibleData[book]);
    const chapter = chapters[Math.floor(Math.random() * chapters.length)];
    const verses = Object.keys(this.bibleData[book][chapter]);
    const verse = verses[Math.floor(Math.random() * verses.length)];
    const text = this.bibleData[book][chapter][verse];
    return { book, chapter, verse, text };
  }

  getVerseOfDay() {
    if (!this.bibleData) return null;

    const VOD_LIST = [
      { d: 1, t: "Valentía", v: ["Josué 1:9", "Salmo 27:1", "Is. 41:10", "2 Tim. 1:7", "Salmo 118:6"] },
      { d: 2, t: "Provisión", v: ["Salmo 23:1", "Fil. 4:19", "Mateo 6:33", "Salmo 34:10", "Mateo 7:11"] },
      { d: 3, t: "Fortaleza", v: ["Fil. 4:13", "Is. 40:31", "Salmo 18:2", "Efesios 6:10", "Hab. 3:19"] },
      { d: 4, t: "Paz", v: ["Juan 14:27", "Fil. 4:7", "Is. 26:3", "Salmo 4:8", "Col. 3:15"] },
      { d: 5, t: "Confianza", v: ["Prov. 3:5", "Jer. 17:7", "Salmo 37:5", "Salmo 62:8", "Is. 12:2"] },
      { d: 6, t: "Amor de Dios", v: ["Juan 3:16", "Rom. 5:8", "1 Juan 4:19", "Sof. 3:17", "Jer. 31:3"] },
      { d: 7, t: "Descanso", v: ["Mateo 11:28", "Salmo 62:1", "Salmo 91:1", "Éxodo 33:14", "Heb. 4:9"] },
      { d: 8, t: "Sabiduría", v: ["Sant. 1:5", "Prov. 2:6", "Salmo 111:10", "Prov. 4:7", "Col. 2:3"] },
      { d: 9, t: "Propósito", v: ["Jer. 29:11", "Rom. 8:28", "Efesios 2:10", "Prov. 16:3", "Salmo 138:8"] },
      { d: 10, t: "Refugio", v: ["Salmo 46:1", "Salmo 9:9", "Prov. 18:10", "Salmo 144:2", "Nahúm 1:7"] },
      { d: 11, t: "Fe", v: ["Heb. 11:1", "Marcos 9:23", "Mateo 21:22", "Rom. 10:17", "2 Cor. 5:7"] },
      { d: 12, t: "Guía", v: ["Salmo 119:105", "Is. 30:21", "Salmo 32:8", "Prov. 3:6", "Salmo 48:14"] },
      { d: 13, t: "Ansiedad", v: ["1 Pedro 5:7", "Fil. 4:6", "Salmo 55:22", "Mateo 6:34", "Salmo 94:19"] },
      { d: 14, t: "Perdonar", v: ["Efesios 4:32", "Col. 3:13", "Mateo 6:14", "Luc. 6:37", "Prov. 17:9"] },
      { d: 15, t: "Gozar", v: ["Neh. 8:10", "Salmo 16:11", "Fil. 4:4", "1 Tes. 5:16", "Hab. 3:18"] },
      { d: 16, t: "Gracia", v: ["Efesios 2:8", "Heb. 4:16", "2 Cor. 12:9", "Rom. 3:24", "Tito 2:11"] },
      { d: 17, t: "Socorro", v: ["Salmo 121:2", "Is. 41:13", "Salmo 145:18", "Heb. 13:6", "Salmo 40:17"] },
      { d: 18, t: "Fidelidad", v: ["Lam. 3:23", "2 Tes. 3:3", "1 Cor. 1:9", "Deut. 7:9", "Salmo 36:5"] },
      { d: 19, t: "Victoria", v: ["Rom. 8:37", "1 Cor. 15:57", "1 Juan 5:4", "Salmo 60:12", "Prov. 21:31"] },
      { d: 20, t: "Corazón", v: ["Prov. 4:23", "Salmo 51:10", "Mateo 5:8", "Ezeq. 36:26", "Salmo 119:11"] },
      { d: 21, t: "Palabra", v: ["Heb. 4:12", "Mateo 4:4", "Is. 40:8", "Salmo 19:7", "Josué 1:8"] },
      { d: 22, t: "Luz", v: ["Mateo 5:14", "Juan 8:12", "Salmo 27:1", "Efesios 5:8", "1 Juan 1:7"] },
      { d: 23, t: "Oración", v: ["Jer. 33:3", "Mateo 7:7", "1 Juan 5:14", "Salmo 145:18", "Luc. 11:9"] },
      { d: 24, t: "Identidad", v: ["Juan 1:12", "1 Pedro 2:9", "2 Cor. 5:17", "Gal. 2:20", "Efesios 1:4"] },
      { d: 25, t: "Fruto", v: ["Gal. 5:22", "Juan 15:5", "Fil. 1:11", "Salmo 1:3", "Sant. 3:17"] },
      { d: 26, t: "Humildad", v: ["Sant. 4:10", "1 Pedro 5:6", "Prov. 22:4", "Miq. 6:8", "Fil. 2:3"] },
      { d: 27, t: "Esperanza", v: ["Rom. 15:13", "Salmo 130:5", "Heb. 10:23", "Is. 40:31", "Job 14:7"] },
      { d: 28, t: "Verdad", v: ["Juan 14:6", "Juan 8:32", "Salmo 25:5", "Efesios 4:25", "3 Juan 1:4"] },
      { d: 29, t: "Servicio", v: ["Gal. 5:13", "Mateo 20:28", "Col. 3:23", "Heb. 6:10", "1 Pedro 4:10"] },
      { d: 30, t: "Justicia", v: ["Mateo 5:6", "Salmo 37:6", "Prov. 21:21", "Is. 32:17", "Rom. 1:17"] },
      { d: 31, t: "Bendición", v: ["Núm. 6:24", "Salmo 67:1", "Deut. 28:2", "Salmo 1:1", "Prov. 10:22"] }
    ];

    const today = new Date();
    const day = today.getDate(); // 1-31
    const month = today.getMonth(); // 0-11

    // Find entry for today
    const entry = VOD_LIST.find(e => e.d === day);
    if (!entry) return this.getRandomVerse(); // Fallback if something weird happens

    // Rotate options based on month to give variety over the year
    const optionIndex = month % 5;
    const rawRef = entry.v[optionIndex];

    // Parse Reference "Book Chapter:Verse"
    // Handle split carefully. Some books have numbers "1 Juan", "2 Tim", etc.
    // Logic: Split by space, last part is Chapter:Verse, rest is Book.
    const parts = rawRef.split(' ');
    const chapterVerse = parts.pop();
    const rawBook = parts.join(' ');
    const [chapter, verse] = chapterVerse.split(':');

    const normalizeBook = (b) => {
      // Remover puntos finales
      let name = b.replace('.', '');
      const map = {
        "Is": "Isaías",
        "Salmo": "Salmos",
        "Fil": "Filipenses",
        "Rom": "Romanos",
        "2 Tim": "2 Timoteo",
        "1 Tim": "1 Timoteo",
        "Efesios": "Efesios",
        "Jer": "Jeremías",
        "Sof": "Sofonías",
        "Heb": "Hebreos",
        "Prov": "Proverbios",
        "Mateo": "San Mateo",
        "Marcos": "San Marcos",
        "Luc": "San Lucas",
        "Juan": "San Juan",
        "1 Juan": "1 Juan", // Already correct but good to be explicit
        "2 Juan": "2 Juan",
        "3 Juan": "3 Juan",
        "Col": "Colosenses",
        "Sant": "Santiago",
        "Nahúm": "Nahúm",
        "Hab": "Habacuc",
        "Ezeq": "Ezequiel",
        "Gal": "Gálatas",
        "Miq": "Miqueas",
        "Lam": "Lamentaciones",
        "2 Tes": "2 Tesalonicenses",
        "1 Tes": "1 Tesalonicenses",
        "1 Cor": "1 Corintios",
        "2 Cor": "2 Corintios",
        "Deut": "Deuteronomio",
        "Num": "Números",
        "Núm": "Números",
        "Neh": "Nehemías",
        "Lev": "Levítico",
        "Tito": "Tito",
        "Job": "Job",
        "Josué": "Josué",
        "1 Pedro": "1 Pedro",
        "2 Pedro": "2 Pedro",
        "Exodo": "Éxodo",
        "Éxodo": "Éxodo"
      };

      // Handle "Salmo" -> "Salmos" explicitly if not in map (though it is)
      return map[name] || name;
    };

    const bookName = normalizeBook(rawBook);

    // Try to get text
    if (this.bibleData[bookName] && this.bibleData[bookName][chapter] && this.bibleData[bookName][chapter][verse]) {
      return {
        book: bookName,
        chapter: chapter,
        verse: verse,
        text: this.bibleData[bookName][chapter][verse],
        theme: entry.t
      };
    } else {
      console.warn(`VOD Not Found: ${bookName} ${chapter}:${verse} (Raw: ${rawRef})`);
      return this.getRandomVerse();
    }
  }

  // Exportar todos los datos del usuario
  exportUserData() {
    return {
      version: "1.0",
      export_date: new Date().toISOString(),
      app_version: "1.1.8",
      data: {
        favorites: this.favorites,
        notes: this.notes,
        highlights: this.highlights,
        settings: this.settings
      }
    };
  }

  // Importar datos del usuario
  importUserData(backupData) {
    if (!backupData.version || !backupData.data) {
      throw new Error("Formato de backup inválido");
    }

    this.favorites = backupData.data.favorites || [];
    this.notes = backupData.data.notes || [];
    this.highlights = backupData.data.highlights || [];
    this.settings = { ...this.settings, ...backupData.data.settings };

    // Guardar en localStorage
    localStorage.setItem('bible_favorites', JSON.stringify(this.favorites));
    localStorage.setItem('bible_notes', JSON.stringify(this.notes));
    localStorage.setItem('bible_highlights', JSON.stringify(this.highlights));
    localStorage.setItem('bible_settings', JSON.stringify(this.settings));
  }
}
