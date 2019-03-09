// This emonë script transcriber is a pair of tangled state machines.
//
// The first machine parses phonemes out of latin letter clusters.
// For example, "m" produces the "m" consonant phoneme,
// but "p" then "h" produces the "ph" consonant phoneme.
// Whereas, "q" produces the "k" and "w" phonemes.
// The machine is "null terminated".
//
// The second machine ingests phonemes and aligns the consonants and vowels to
// suit the emonë script, where consonants are aligned
// on a horizontal zig-zag and vowels dance between them.  Words must begin on
// the zig.
// Sometimes, place holder vowels and consonants need to be introduced ("m" and
// "e") when there are clusters of consonants, or more than two vowels between
// consonants.
//
// The final pass simplifies vowel glyphs when connecting two consonants with a
// single vowel, when the art permits.
// We then measure the dimensions of the rendered block.

export function transcribe(text) {
    const glyphs = embelish(parse(text));
    const size = measure(glyphs);
    console.log(glyphs);
    return {glyphs, size};
}

// makeParser takes an initial parse state (the grammar's start rule) and
// returns a function that runs the parser to completion with a string of text,
// returning the final result.
// This glues a pure functional parser into an imperative interface.
function makeParser(start) {
    return (text) => {
        let result = [];
        let state = start((res) => {
            result = res;
            return eof;
        });
        for (const character of text) {
            state = state(character);
        }
        state = state(null);
        return result;
    };
}

// start accepts a callback to receive the final trascribed model
// and combines all the machinery for the transcriber.
// favorConsonant is the initial rule for the latin phoneme parser.
// That in turn emits phonemes into an aligner state machine.
// The aligner emits glyphs into a collector, which emits an
// array of glyphs into the callback when the stream ends.
function start(cb) {
    return favorConsonant(aligner(collector([], cb)));
}

const parse = makeParser(start);

function collector(head, cb) {
    return (tail) => {
        if (tail == null) {
            return cb(head);
        }
        return collector([...head, tail], cb);
    };
}

// treat w and y as vowels after scanning a consonant.
function favorVowel(emit) {
    return (letter) => {
        switch (letter) {
        case 'w': case'y':
            return maybeDiphthong(emit, letter);
        }
        return favorConsonant(emit)(letter);
    };
}

// treat w and y as consonants initially.
function favorConsonant(emit) {
    return (first) => {
        switch (first) {
        case null:
            return favorConsonant(emit(null));
        case '\n': case '\r':
            return space(emit({type: 'newline'}));
        case ' ':
            return space(emit({type: 'space'}));
        case 'x':
            return favorConsonant(emit)('k')('s');
        case 'q':
            return (second) => {
                let next = favorConsonant(emit)('k')('w');
                if (second != 'u' && second != 'w') {
                    next = next(second);
                }
                return next;
            };
        case 'w': case 'y':
            return favorVowel(emit({type: 'consonant', consonant: first}));
        case 'e': case 'i': case 'y': case 'a': case 'o': case 'u':
            return maybeDiphthong(emit, first);
        case 'r': case 'l': case 'm': case 'v': case 'f': case 'j': case 'z':
            return favorVowel(emit({type: 'consonant', consonant: first}));
        case 'g': case 'k':
            return (second) => {
                switch (second) {
                case 'h':
                    return favorVowel(emit({type: 'consonant', consonant: first+second}));
                }
                return favorVowel(emit({type: 'consonant', consonant: first}))(second);
            };
        case 'c':
            return (second) => {
                switch (second) {
                case 'h':
                    return favorVowel(emit({type: 'consonant', consonant: first+second}));
                }
                // k instead of c
                return favorVowel(emit({type: 'consonant', consonant: 'k'}))(second);
            };
        case 'n':
            return (second) => {
                switch (second) {
                case 'g':
                    return favorVowel(emit({type: 'consonant', consonant: first+second}));
                }
                return favorVowel(emit({type: 'consonant', consonant: first}))(second);
            };
        case 'b':
            return (second) => {
                switch (second) {
                case 'h':
                    // v instead of bh
                    return favorVowel(emit({type: 'consonant', consonant: 'v'}));
                }
                return favorVowel(emit({type: 'consonant', consonant: first}))(second);
            };
        case 'p':
            return (second) => {
                switch (second) {
                case 'h':
                    // f instead of ph
                    return favorVowel(emit({type: 'consonant', consonant: 'f'}));
                }
                return favorVowel(emit({type: 'consonant', consonant: first}))(second);
            };
        case 't':
            return (second) => {
                switch (second) {
                    case 'h': case 's':
                    return favorVowel(emit({type: 'consonant', consonant: first+second}));
                }
                return favorVowel(emit({type: 'consonant', consonant: first}))(second);
            };
        case 'd':
            return (second) => {
                switch (second) {
                    case 'h': case 'j': case 'z':
                    return favorVowel(emit({type: 'consonant', consonant: first+second}));
                }
                return favorVowel(emit({type: 'consonant', consonant: first}))(second);
            };
        case 's':
            return (second) => {
                switch (second) {
                case 'c':
                    return (third) => {
                        switch (third) {
                        case 'h':
                            return favorVowel(emit({type: 'consonant', consonant: 'sh'}));
                        }
                        return favorVowel(emit({type: 'consonant', consonant: 's'})({type: 'consonant', consonant: 'k'}))(third);
                    };
                }
                return favorVowel(emit({type: 'consonant', consonant: 's'}))(second);
            };
        }
        return favorVowel(emit({type: 'error', error: 'unexpected ' + first}));
    };
}

function maybeDiphthong(emit, first) {
    return (second) => {
        switch (second) {
        case null:
            return favorConsonant(emit({type: 'vowel', vowel: first})(null));
        case ' ':
            return space(emit({type: 'vowel', vowel: first})({type: 'space'}));
        case 'e':
        case 'i':
        case 'y':
        case 'a':
        case 'o':
        case 'u':
        case 'w':
            return favorConsonant(emit({type: 'diphthong', first, second}));
        }
        return favorConsonant(emit({type: 'vowel', vowel: first}))(second);
    };
}

function space(emit) {
    return (letter) => {
        switch (letter) {
        case ' ': case '\n': case '\r': case '\t':
            return space(emit);
        }
        return favorConsonant(emit)(letter);
    };
}

function eof() {
    return eof;
}

// ---

// The aligner has five states (depending on whether anticipating
// a consonant or vowel on the high or low end of the zig-zag curve).
// In each state, the aligner considers what to do when encountering
// vowels, phonemes, dipthongs, and white space.
function aligner(emit) {
    return beforeHigh({x: 0, y: 0, empty: true}, emit);
}

function beforeHigh(term, emit) {
    return (phoneme) => {
        console.log('before high', phoneme);
        if (phoneme == null) {
            return alignerEnd(emit(term)(null));
        }
        switch (phoneme.type) {
        case 'vowel':
            return high({
                ...term,
                empty: false,
                north: phoneme.vowel,
            }, {
            }, {
                empty: false,
                center: 'm',
            }, emit);
        case 'diphthong':
            return low({
                x: term.x,
                y: term.y + 1,
                empty: false,
                north: phoneme.second,
            }, {
            }, {
                empty: false,
                center: 'm',
            }, emit({
                ...term,
                empty: false,
                south: phoneme.first,
            }));
        case 'consonant':
            return afterHigh({
                ...term,
                empty: false,
                center: phoneme.consonant,
            }, {
                empty: false,
                south: 'e',
            }, {
                empty: false,
                north: 'e',
            }, emit);
        case 'space':
            return beforeHigh(term, emit);
        case 'newline':
            return beforeHigh({
                x: 0,
                y: term.y + 2,
                empty: true,
            }, emit(term));
        case 'error':
            return beforeHigh(appendError(term, phoneme.error), emit);
        }
    };
}

function high(term, vowelConnector, consonantConnector, emit) {
    return (phoneme) => {
        console.log('high', phoneme);
        if (phoneme == null) {
            return alignerEnd(emit(term)(null));
        }
        switch (phoneme.type) {
        case 'vowel':
            return low({
                x: term.x,
                y: term.y + 1,
                empty: true,
            }, {
                empty: false,
                north: phoneme.vowel,
            }, {
                empty: false,
                center: 'm',
            }, emit({
                ...term,
                ...consonantConnector,
                empty: false,
                south: phoneme.vowel,
            }));
        case 'diphthong':
            return low({
                x: term.x,
                y: term.y + 1,
                empty: false,
                north: phoneme.second,
            }, {
            }, {
                empty: false,
                center: 'm',
            }, emit({
                ...term,
                ...consonantConnector,
                empty: false,
                south: phoneme.first,
            }));
        case 'consonant':
            return afterHigh({
                ...term,
                ...vowelConnector,
                empty: false,
                center: phoneme.consonant,
            }, {
                empty: false,
                south: 'e',
            }, {
                empty: false,
                north: 'e',
            }, emit);
        case 'space':
            if (term.west || term.north) {
                // If the previous word ended with a diphthong,
                // land on a trailing consonant connector
                // and begin the next word one column over.
                return beforeHigh({
                    x: term.x + 1,
                    y: term.y,
                    empty: true,
                }, emit({
                    ...term,
                    empty: false,
                    center: 'm',
                }));
            }
            // Otherwise, just ditch the consonant and vowel connectors.
            return beforeHigh(term, emit);
        case 'newline':
            if (term.west) {
                // If the previous word ended with a diphthong,
                // land on a trailing consonant connector
                // and begin the next word on the next line.
                return beforeHigh({
                    x: 0,
                    y: term.y + 2,
                    empty: true,
                }, emit({
                    ...term,
                    empty: false,
                    center: 'm',
                }));
            }
            return beforeHigh({
                x: 0,
                y: term.y + 2,
                empty: true,
            }, emit(term));
        case 'error':
            return high(appendError(term, phoneme.error), vowelConnector, consonantConnector, emit);
        }
        return alignerEnd(emit(null));
    };
}

function afterHigh(term, firstVowelConnector, secondVowelConnector, emit) {
    return (phoneme) => {
        console.log('after high', phoneme);
        if (phoneme == null) {
            return alignerEnd(emit(term)(null));
        }
        switch (phoneme.type) {
        case 'vowel':
            return low({
                x: term.x,
                y: term.y + 1,
                empty: true,
            }, {
                empty: false,
                north: phoneme.vowel,
            }, {
                empty: false,
                center: 'm',
            }, emit({
                ...term,
                empty: false,
                south: phoneme.vowel,
            }));
        case 'diphthong':
            return low({
                x: term.x,
                y: term.y + 1,
                empty: false,
                north: phoneme.second,
            }, {
            }, {
                empty: false,
                center: 'm',
            }, emit({
                ...term,
                empty: false,
                south: phoneme.first,
            }));
        case 'consonant':
            return afterLow({
                x: term.x,
                y: term.y + 1,
                ...secondVowelConnector,
                empty: false,
                center: phoneme.consonant,
            }, {
                empty: false,
                east: 'e',
            }, {
                empty: false,
                west: 'e',
            }, emit({
                ...term,
                ...firstVowelConnector,
            }));
        case 'space':
            return beforeHigh({
                x: term.x + 1,
                y: term.y,
                empty: true,
            }, emit(term));
        case 'newline':
            return beforeHigh({
                x: 0,
                y: term.y + 2,
                empty: true,
            }, emit(term));
        case 'error':
            return afterHigh(appendError(term, phoneme.error), firstVowelConnector, secondVowelConnector, emit);
        }
        return alignerEnd(emit(null));
    };
}

function low(term, vowelConnector, consonantConnector, emit) {
    return (phoneme) => {
        console.log('low', phoneme);
        if (phoneme == null) {
            return alignerEnd(emit(term)(null));
        }
        switch (phoneme.type) {
        case 'vowel':
            return high({
                x: term.x + 1,
                y: term.y - 1,
                empty: true,
            }, {
                empty: false,
                west: phoneme.vowel,
            }, {
                empty: false,
                center: 'm',
            }, emit({
                ...term,
                ...consonantConnector,
                empty: false,
                east: phoneme.vowel,
            }));
        case 'diphthong':
            return high({
                x: term.x + 1,
                y: term.y - 1,
                empty: false,
                west: phoneme.second,
            }, {
            }, {
                empty: false,
                center: 'm',
            }, emit({
                ...term,
                ...consonantConnector,
                empty: false,
                east: phoneme.first,
            }));
        case 'consonant':
            return afterLow({
                ...term,
                ...vowelConnector,
                empty: false,
                center: phoneme.consonant,
            }, {
                empty: false,
                east: 'e',
            }, {
                empty: false,
                west: 'e',
            }, emit);
        case 'space':
            return afterLow(term, {}, {}, emit);
        case 'newline':
            return beforeHigh({
                x: 0,
                y: term.y + 1,
                empty: true,
            }, emit(term));
        case 'error':
            return low(appendError(term, phoneme.error), vowelConnector, consonantConnector, emit);
        }
    };
}

function afterLow(term, firstVowelConnector, secondVowelConnector, emit) {
    return (phoneme) => {
        console.log('after low', phoneme);
        if (phoneme == null) {
            return alignerEnd(emit(term))(null);
        }
        switch (phoneme.type) {
        case 'vowel':
            return high({
                x: term.x + 1,
                y: term.y - 1,
                empty: true,
            }, {
                empty: false,
                west: phoneme.vowel,
            }, {
                empty: false,
                center: 'm',
            }, emit({
                ...term,
                empty: false,
                east: phoneme.vowel,
            }));
        case 'diphthong':
            return high({
                x: term.x + 1,
                y: term.y - 1,
                empty: false,
                west: phoneme.second,
            }, {
            }, {
                empty: false,
                center: 'm',
            }, emit({
                ...term,
                empty: false,
                east: phoneme.first,
            }));
        case 'consonant':
            return afterHigh({
                x: term.x + 1,
                y: term.y - 1,
                ...secondVowelConnector,
                empty: false,
                center: phoneme.consonant,
            }, {
                empty: false,
                south: 'e',
            }, {
                empty: false,
                north: 'e',
            }, emit({
                ...term,
                ...firstVowelConnector,
            }));
        case 'space':
            return high({
                x: term.x + 1,
                y: term.y - 1,
                empty: true,
            }, {}, {}, emit(term));
        case 'newline':
            return beforeHigh({
                x: 0,
                y: term.y + 1,
                empty: true,
            }, emit(term));
        case 'error':
            return afterLow(appendError(term, phoneme.error), firstVowelConnector, secondVowelConnector, emit);
        }
    };
}

function alignerEnd(emit) {
    return (phoneme) => {
        // wat?
        return alignerEnd(emit(null));
    };
}

function appendError(term, error) {
    return {
        ...term,
        errors: [...(term.errors || []), error],
    };
}

function io(glyph) {
    return {
        left: glyph.dental ? 'outer' : 'inner',
        right: glyph.palatal ? 'outer' : 'inner',
    };
}

function measure(glyphs) {
    return {
        x: glyphs.reduce((max, {x}) => Math.max(x+1, max), 1),
        y: glyphs.reduce((max, {y}) => Math.max(y+1, max), 1),
    };
}

// embelish receives an entire glyph model,
// removes the empty slots, and translates directives like "e from west" into
// the corresponding label names for strokes in the SVG file.
// The renderer accepts the resulting model.
function embelish(glyphs) {
    return glyphs.filter(({empty}) => !empty).map((glyph) => ({
        ...glyph,
        ...(consonantGlyphs[glyph.center] || {}),
    })).map((glyph, i, glyphs) => {
        const next = glyphs[i+1] || {};
        const {left, right} = io(glyph);
        const {left: nextLeft, right: nextRight} = io(next);
        if (glyph.west) {
            glyph = {...glyph, [glyph.west + '-west-' + left]: true};
        }
        if (glyph.north) {
            glyph = {...glyph, [glyph.north + '-north-' + left]: true};
        }
        if (glyph.east) {
            let name = glyph.east + '-east-' + right;
            const longName = glyph.east + '-east-' + right + '-' + nextLeft;
            if (glyph.east === next.west && vowelGlyphs[longName]) {
                name = longName;
                delete next.west;
            }
            glyph = {...glyph, [name]: true};
        }
        if (glyph.south) {
            let name = glyph.south + '-south-' + right;
            const longName = glyph.south + '-south-' + right + '-' + nextLeft;
            if (glyph.south === next.north && vowelGlyphs[longName]) {
                name = longName;
                delete next.north;
            }
            glyph = {...glyph, [name]: true};
        }
        return glyph;
    });
}

// How to construct a glyph for each consonant, using the names of strokes
// (inkscape layer labels).
const consonantGlyphs = {
    l:  {'l': true},
    r:  {'r': true},
    w:  {'consonantal-w': true},
    y:  {'consonantal-y': true},

    m:  {'labial': true},
    b:  {'labial': true, 'plosive': true},
    p:  {'labial': true, 'plosive': true, 'plosive-unvoiced': true},
    v:  {'labial': true, 'fricative': true},
    f:  {'labial': true, 'fricative': true, 'fricative-unvoiced': true},

    n:  {'labial': true, 'dental': true},
    d:  {'labial': true, 'dental': true, 'plosive': true},
    t:  {'labial': true, 'dental': true, 'plosive': true, 'plosive-unvoiced': true},
    dh: {'labial': true, 'dental': true, 'fricative': true},
    th: {'labial': true, 'dental': true, 'fricative': true, 'fricative-unvoiced': true},

    ng: {'labial': true, 'palatal': true},
    g:  {'labial': true, 'palatal': true, 'plosive': true},
    k:  {'labial': true, 'palatal': true, 'plosive': true, 'plosive-unvoiced': true},
    gh: {'labial': true, 'palatal': true, 'fricative': true},
    kh: {'labial': true, 'palatal': true, 'fricative': true, 'fricative-unvoiced': true},

    dz: {'labial': true, 'dental': true, 'dental-alveolar': true, 'plosive': true},
    ts: {'labial': true, 'dental': true, 'dental-alveolar': true, 'plosive': true, 'plosive-unvoiced': true},
    z:  {'labial': true, 'dental': true, 'dental-alveolar': true, 'fricative': true},
    s:  {'labial': true, 'dental': true, 'dental-alveolar': true, 'fricative': true, 'fricative-unvoiced': true},

    dj: {'labial': true, 'palatal': true, 'palatal-alveolar': true, 'plosive': true},
    ch: {'labial': true, 'palatal': true, 'palatal-alveolar': true, 'plosive': true, 'plosive-unvoiced': true},
    j:  {'labial': true, 'palatal': true, 'palatal-alveolar': true, 'fricative': true},
    sh: {'labial': true, 'palatal': true, 'palatal-alveolar': true, 'fricative': true, 'fricative-unvoiced': true},
};

// A list of current SVG labels.
const vowelGlyphs = {
    "e-west-outer": true,
    "e-west-inner": true,
    "e-east-outer-inner": true,
    "e-east-outer-outer": true,
    "e-east-outer": true,
    "e-east-inner-outer": true,
    "e-east-inner-inner": true,
    "e-east-inner": true,
    "e-south-outer-outer": true,
    "e-south-outer": true,
    "e-south-inner-inner": true,
    "e-south-inner": true,
    "e-north-outer-outer": true,
    "e-north-inner-inner": true,
    "e-north-outer": true,
    "e-north-inner": true,
    "i-west-outer": true,
    "i-west-inner": true,
    "i-east-outer-outer": true,
    "i-east-outer-inner": true,
    "i-east-outer": true,
    "i-east-inner-outer": true,
    "i-east-inner-inner": true,
    "i-east-inner": true,
    "i-south-outer-outer": true,
    "i-south-outer-inner": true,
    "i-south-outer": true,
    "i-south-inner": true,
    "i-south-inner-outer": true,
    "i-south-inner-inner": true,
    "i-north-outer": true,
    "i-north-inner": true,
    "y-west-outer": true,
    "y-west-inner": true,
    "y-east-outer-outer": true,
    "y-east-outer-inner": true,
    "y-east-outer": true,
    "y-east-inner-inner": true,
    "y-east-inner-outer": true,
    "y-east-inner": true,
    "y-south-outer-outer": true,
    "y-south-outer": true,
    "y-south-inner": true,
    "y-north-outer-outer": true,
    "y-north-outer": true,
    "y-north-inner": true,
    "a-west-outer": true,
    "a-west-inner": true,
    "a-east-outer-outer": true,
    "a-east-outer": true,
    "a-east-inner-inner": true,
    "a-east-inner": true,
    "a-south-outer-outer": true,
    "a-south-outer": true,
    "a-south-inner": true,
    "a-north-outer-outer": true,
    "a-north-outer": true,
    "a-north-inner": true,
    "o-west-outer": true,
    "o-west-inner": true,
    "o-east-outer-outer": true,
    "o-east-outer": true,
    "o-east-inner": true,
    "o-south-outer": true,
    "o-south-inner": true,
    "o-north-outer": true,
    "o-north-inner": true,
    "u-west-outer": true,
    "u-west-inner": true,
    "u-east-outer-outer": true,
    "u-east-outer": true,
    "u-east-inner-inner": true,
    "u-east-inner": true,
    "u-south-outer-outer": true,
    "u-south-outer": true,
    "u-south-inner": true,
    "u-north-outer-outer": true,
    "u-north-outer": true,
    "u-north-inner": true,
    "w-west-outer": true,
    "w-west-inner": true,
    "w-east-outer-outer": true,
    "w-east-outer": true,
    "w-east-inner": true,
    "w-south-outer": true,
    "w-south-inner": true,
    "w-north-outer": true,
    "w-north-inner": true,
};
