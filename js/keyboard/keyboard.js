// Event Listeners will be defined in app.js, but will correspond to the method names
let keypress_colors = {
    "human": "#d2292d",
    "machine": "#6c63ff"
};
class OnScreenKeyboard extends EventEmitter {
    constructor(container, min_note = 48, max_note = 84) {
        super();
        this._container = document.createElement('div');
        container.appendChild(this._container);
        this.resize(min_note, max_note);
        this._pointedNotes = {};
        this.min_note = min_note;
        this.max_note = max_note;
        this.show_notes = false;
        this.show_bindings = true;
        this.key_bindings = {
            60: "Z",
            61: "S",
            62: "X",
            63: "D",
            64: "C",
            65: "V",
            66: "G",
            67: "B",
            68: "H",
            69: "N",
            70: "J",
            71: "M",
            72: "Q",
            73: "L",
            74: "W",
            75: "3",
            76: "E",
            77: "R",
            78: "5",
            79: "T",
            80: "6",
            81: "Y",
            82: "7",
            83: "U",
            84: "I",
            85: "9",
            86: "O",
            87: "0",
            88: "P",
            89: "[",
            90: "=",
            91: "]"
        };
    }

    isAccidental(note) {
        return ([1, 3, 6, 8, 10].indexOf(note % 12) !== -1);
    }

    resize(min_note, max_note) {
        this.min_note = min_note;
        this.max_note = max_note;
        this._container.innerHTML = ""; // clear previous keyboard
        let nAccidentals = _.range(min_note, max_note + 1).filter(this.isAccidental).length;
        let keyWidth = 100 / (max_note - min_note - nAccidentals + 1);
        let keyInnerWidth = 100 / (max_note - min_note - nAccidentals + 1) - 0.1;
        let gap = keyWidth - keyInnerWidth;
        let accumulatedWidth = 0;
        let keys = {};
        for (let note = min_note; note <= max_note; ++note) {
            let accidental = this.isAccidental(note);
            let key = document.createElement("div");
            key.id = note.toString();
            key.setAttribute("touch-action", "none"); // Prevent user from pinching into the key on touch devices
            key.classList.add("key");
            if (accidental) {
                key.classList.add("accidental");
                key.style.left = `${accumulatedWidth -
                    gap -
                    (keyWidth / 2 - gap) / 2}%`;
                key.style.width = `${keyWidth / 2}%`;
            } else {
                key.style.left = `${accumulatedWidth}%`;
                key.style.width = `${keyInnerWidth}%`;
            }
            if (this.show_bindings && this.show_notes) {
                let binding = this.key_bindings[note] ?? "";
                key.innerHTML = `<span class="user-select-none"><strong>${binding}</strong> (${Tonal.Midi.midiToNoteName(note)})</span>`;
            }
            else if (this.show_notes) {
                key.innerHTML = `<span class="user-select-none">${Tonal.Midi.midiToNoteName(note)}</span>`;
            } else if (this.show_bindings) {
                let binding = this.key_bindings[note] ?? "";
                key.innerHTML = `<span class="user-select-none"><strong>${binding}</strong></span>`;
            }

            this._container.appendChild(key);
            if (!accidental) {
                accumulatedWidth += keyWidth;
            }
            this._bindKeyEvents(key);
            keys[note] = key;
        }
        this._keys = keys;
    }

    _bindKeyEvents(key) { // Add event listeners which will trigger when the key is pressed
        key.addEventListener("pointerdown", (event) => { // instead of using mousedown, use pointerdown to allow for both mouse and touch controls
            const noteNum = parseInt(event.target.id);
            this.emit("keyDown", noteNum, true); // Emit event 
            this._pointedNotes[noteNum] = true;
            event.preventDefault();
        });
        key.addEventListener("pointerup", (event) => {
            const noteNum = parseInt(event.target.id);
            this.emit("keyUp", noteNum);
            delete this._pointedNotes[noteNum];
        });
    }

    keyDown(noteNum, human = true) {
        if (noteNum < this.min_note || noteNum > this.max_note) {
            return;
        }
        this._keys[noteNum].classList.add("down");
        this.animatePlay(this._keys[noteNum], noteNum, human);
    }

    keyUp(noteNum) {
        if (noteNum < this.min_note || noteNum > this.max_note) {
            return;
        }
        this._keys[noteNum].classList.remove("down");
    }

    animatePlay(key, noteNum, human) {
        let sourceColor = human ? keypress_colors["human"] : keypress_colors["machine"];
        let targetColor = this.isAccidental(noteNum) ? "black" : "white";
        key.animate(
            [
                {
                    backgroundColor: sourceColor,
                },
                {
                    backgroundColor: targetColor,
                }
            ],
            {
                duration: 700, easing: 'ease-out'
            }
        );
    }
}

class Keyboard extends EventEmitter {
    constructor(container) {
        super();
        this._container = container;
        // Configure AudioKeys
        this._keyboard = new AudioKeys({
            rows: 2,
            polyphony: 88
        });
        this._keyboard.down(event => {
            this.keyDown(event.note, true);
            this._emitKeyDown(event.note, true);

        });
        this._keyboard.up(event => {
            this.keyUp(event.note);
            this._emitKeyUp(event.note);
        });
        this.min_note = 48;
        this.max_note = 83;
        // Configure On Screen Controls
        this._interface = new OnScreenKeyboard(this._container, this.min_note, this.max_note);
        this._interface.on("keyDown", (note, human) => {
            this.keyDown(note, human);
            this._emitKeyDown(note, human);
        });
        this._interface.on("keyUp", (note) => {
            this.keyUp(note);
            this._emitKeyUp(note);
        });
        window.addEventListener("resize", this._resize.bind(this));
        this._resize(); // Set initial size
        // Configure MIDI Controls
        this.midi = false;
        WebMidi.enable().then(this.midi_enabled).catch((err) => {
            console.error(err);
            this.midi = false;
        });

    }

    _emitKeyDown(note, human) {
        this.emit("keyDown", note, human);
    }

    _emitKeyUp(note) {
        this.emit("keyUp", note);
    }


    keyDown(noteNum, human = true, velocity = 0.4) {
        let freq = Tone.Frequency(noteNum, "midi");
        if (human) {
            let synth = new Tone.Synth(synthConfig).connect(synthFilter);
            synthsPlaying[noteNum] = synth;
            synth.triggerAttack(freq, Tone.now(), velocity);
        }
        sampler.triggerAttack(freq);
    }

    keyUp(noteNum) {
        if (synthsPlaying[noteNum]) {
            let synth = synthsPlaying[noteNum];
            synth.triggerRelease();
            setTimeout(() => {
                synth.dispose(), 2000;
            });
            synthsPlaying[noteNum] = null;
        }
    }

    _resize() {
        let keyWidth = 30;
        let octaves = Math.round((window.innerWidth / keyWidth) / 12);
        this.max_note = Math.min(this.min_note + (octaves * 12), 83); // ImprovRNN can only handle up to 5 octaves
        this._interface.resize(this.min_note, this.max_note);
    }

    midi_enabled() {
        if (WebMidi.inputs.length >= 1) {
            // MIDI Device Found
            WebMidi.inputs.forEach((input) => {
                input.addListener("noteon", e => {
                    this.keyDown(e.note.number);
                    this._emitKeyDown(e.note.number);
                });
                input.addListener("noteoff", e => {
                    this.keyUp(e.note.number);
                    this._emitKeyUp(e.note.number);
                });
                WebMidi.addListener("disconnected", device => {
                    if (device.input) {
                        device.input.removeListener("noteon");
                        device.input.removeListener("noteoff");
                    }
                });
            });
        }
    }
}