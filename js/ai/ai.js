
class AI_Model extends EventEmitter {
    constructor(model_config = "https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/chord_pitches_improv", temperature = 1.0, max_sequence_length = 10, drop_prob = 0.3, launchWaitTime = 0.5, steps = 20) {
        super();
        this.temperature = temperature;
        this.model_config = model_config;
        this.rnn = new music_rnn.MusicRNN(this.model_config);
        this.notes = []; // Store keys played in a buffer
        this.running = false;
        this.stopCurrentSequenceGenerator;
        this.firstTime = false;
        this.max_sequence_length = max_sequence_length;
        this.drop_prob = drop_prob;
        this.launchWaitTime = launchWaitTime;
        this.steps = steps; // How many steps to predict in the future
    }

    buildNoteSequence(seed) {
        return core.sequences.quantizeNoteSequence(
            {
                ticksPerQuarter: 220,
                totalTime: seed.length * 0.5,
                quantizationInfo: {
                    stepsPerQuarter: 1
                },
                timeSignatures: [
                    {
                        time: 0,
                        numerator: 4,
                        denominator: 4
                    }
                ],
                tempos: [
                    {
                        time: 0,
                        qpm: 120
                    }
                ],
                notes: seed.map((n, idx) => ({ // format of the input to the model
                    pitch: n.note,
                    startTime: idx * 0.5,
                    endTime: (idx + 1) * 0.5
                }))
            },
            1
        );
    }

    generateDummySequence() {
        return this.rnn.continueSequence(
            this.buildNoteSequence([
                {
                    note: 60,
                    time: Tone.now()
                }
            ]),
            20,
            this.temperature,
            ['Cm']
        );
    }

    getKeyIntervals(notes) {
        let intervals = [];
        for (let i = 0; i < notes.length - 1; ++i) {
            let rawInterval = notes[i + 1].time - notes[i].time;
            let measure = _.minBy(["8n", "4n"], (subdiv) => { // run the function through the array, and return the value which returns the smallest number
                // subdiv --> 16th note
                return Math.abs(rawInterval - Tone.Time(subdiv).toSeconds());
            });
            intervals.push(Tone.Time(measure).toSeconds());
        }
        return intervals;
    }

    getSequencePlayIntervalTime(notes) {
        if (notes.length <= 1) {
            return Tone.Time("8n").toSeconds();
        }
        let intervals = this.getKeyIntervals(notes);
        return _.min(intervals);
    }

    getSequenceLaunchWaitTime(notes) {
        if (notes.length <= 1) {
            return this.launchWaitTime;
        }
        let intervals = this.getKeyIntervals(notes);
        let maxInterval = _.max(intervals);
        return maxInterval * 2;
    }

    detectChord(notes) {
        notes = notes.map(n => Tonal.Midi.midiToNoteName(n.note));
        return Tonal.Chord.detect(notes);
    }
    generateNext() { // generates the notes based on the sequence
        if (!this.running) return;
        if (this.generatedSequence.length < this.max_sequence_length) {
            this.lastGenerationTask = this.rnn
                .continueSequence(this.noteSeq, this.steps, this.temperature, [this.chord]) // continues a provided quantized NoteSequence
                .then(genSeq => {
                    this.generatedSequence = this.generatedSequence.concat(
                        genSeq.notes.map(n => n.pitch)
                    );
                    setTimeout(this.generateNext, this.generationIntervalTime * 1000);
                });
        } else {
            setTimeout(this.generateNext, this.generationIntervalTime * 1000);
        }
    }

    consumeNext() {
        if (this.generatedSequence.length) {
            let note = this.generatedSequence.shift(); // .shift() removes the first element from an array and returns that removed element
            if (note > 0) {
                this.emit("keyDown", note, false); // set human=false 
                this.emit("keyUp", note);
            }
        }
    }
    startSequenceGenerator(notes) {
        this.running = true;
        this.lastGenerationTask = Promise.resolve();
        this.chord = this.detectChord(notes);
        this.chord = _.first(this.chord) || "CM";
        this.noteSeq = this.buildNoteSequence(notes);
        this.generatedSequence = Math.random() < (1 - this.drop_prob) ? _.clone(this.noteSeq.notes.map(n => n.pitch)) : [];
        let launchWaitTime = this.getSequenceLaunchWaitTime(notes);
        let playIntervalTime = this.getSequencePlayIntervalTime(notes);
        this.generationIntervalTime = playIntervalTime / 2;
        let generateNext = this.generateNext.bind(this); // do a bind to ensure the function is able to access the parent class
        setTimeout(generateNext, launchWaitTime * 1000);
        let consumeNext = this.consumeNext.bind(this);
        let consumerId = Tone.Transport.scheduleRepeat(consumeNext, playIntervalTime, Tone.Transport.seconds + launchWaitTime); // (callback, interval, starttime, duration = infinity)
        if (!this.firstTime) {
            this.firstTime = true;
            document.getElementById("help-text").classList.add("fade");
        }
        return () => {
            this.running = false;
            Tone.Transport.clear(consumerId);
        };
    }
    updateChord({ add = null, remove = null }) {
        if (add) {
            this.notes.push({ note: add, time: Tone.now() });
        }
        if (remove && _.some(this.notes, { note: remove })) {
            _.remove(this.notes, { note: remove });
        }

        if (this.stopCurrentSequenceGenerator) {
            this.stopCurrentSequenceGenerator();
            this.stopCurrentSequenceGenerator = null;
        }

        // Check if the model is ready to start playing
        if (this.notes.length && !this.stopCurrentSequenceGenerator) {
            this.stopCurrentSequenceGenerator = this.startSequenceGenerator(_.cloneDeep(this.notes));
        }
    }

    keyDown(noteNum, human = true) {
        if (human) {
            this.updateChord({ add: noteNum });
        }
    }

    keyUp(noteNum) {
        this.updateChord({ remove: noteNum });
    }
}