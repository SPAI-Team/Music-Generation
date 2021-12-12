// Event Listeners will be defined in app.js, but will correspond to the method names
class OnScreenKeyboard extends EventEmitter {
    constructor(container, min_note = 48, max_note = 84) {
        super();
        this._container = document.createElement('div');
        container.appendChild(this._container);
        this.resize(min_note, max_note);
        this._pointedNotes = {};
        this.min_note = min_note;

    }

    isAccidental(note) {
        return ([1, 3, 6, 8, 10].indexOf(note % 12) !== -1);
    }

    resize(min_note, max_note) {
        this._container.innerHTML = ""; // clear previous keyboard
        console.log("Cleared")
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
            this._container.appendChild(key);
            console.log(`Add ${note}`)
            if (!accidental) {
                accumulatedWidth += keyWidth;
            }
            this._bindKeyEvents(key);
            keys[note] = key;
        }
        this.keys = keys;
    }

    _bindKeyEvents(key) { // Add event listeners which will trigger when the key is pressed
        key.addEventListener("mousedown", (event) => {
            const noteNum = parseInt(event.target.id);
            this.emit("keyDown", noteNum); // Emit event 
            this._pointedNotes[noteNum] = true;
            event.preventDefault();
        });
        key.addEventListener("mouseup", (event) => {
            const noteNum = parseInt(event.target.id);
            this.emit("keyUp", noteNum);
            delete this._pointedNotes[noteNum];
        });
    }

    keyDown(noteNum, human = true) {
        this._keys[noteNum].classList.add("down");
        this.animatePlay(this._keys[noteNum], noteNum, human);
    }

    keyUp(noteNum) {
        this._keys[noteNum].classList.remove("down");
    }

    animatePlay(key, noteNum, human) {
        let sourceColor = human ? "#1E88E5" : "#E91E63";
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
        if (!human) {
            key.animate(
                [
                    {
                        opacity: 0.9
                    },
                    {
                        opacity: 0
                    }
                ], {
                duration: 700, easing: 'ease-out'
            }
            );
        }
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
            this.keyDown(event.note);
            this._emitKeyDown(event.note);

        });
        this._keyboard.up(event => {
            this.keyUp(event.note);
            this._emitKeyUp(event.note);
        });
        this.min_note = 48;
        this.max_note = 84;
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


        // TODO: Configure MIDI Input Controls (Not top priority since MIDI controller not available atm)


    }

    _emitKeyDown(note) {
        this.emit("keyDown", note);
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
            console.log(`Keydown: ${noteNum}`)
        }
        sampler.triggerAttack(freq);
    }

    keyUp(noteNum) {
        if (synthsPlaying[noteNum]) {
            let synth = synthsPlaying[noteNum];
            synth.triggerRelease();
            console.log(`Keyup: ${noteNum}`);
            setTimeout(() => {
                synth.dispose(), 2000;
            });
            synthsPlaying[noteNum] = null;
        }
    }

    _resize() {
        let keyWidth = 30;
        let octaves = Math.round((window.innerWidth / keyWidth) / 12);
        this.max_note = this.min_note + (octaves * 12);
        this._interface.resize(this.min_note, this.max_note);
    }
}