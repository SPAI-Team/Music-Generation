class AI_Model extends EventEmitter {
    constructor(model_config = "https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/chord_pitches_improv", temperature = 1.1) {
        super();
        this.temperature = temperature;
        this.model_config = model_config;
        this.rnn = new music_rnn.MusicRNN(this.model_config);
        this.running = false;
        this.notes = [];
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
            return 1;
        }
        let intervals = this.getKeyIntervals(notes);
        let maxInterval = _.max(intervals);
        return maxInterval * 2;
    }

    detectChord(notes) {
        return Tonal.Chord.detect(notes);
    }

    keyDown(noteNum, human = true) {
        if (human) {
            updateChord({ add: noteNum });
        }
    }

    keyUp(noteNum) {
        updateChord({ remove: noteNum });
    }
}

const AI = new AI_Model();
let stopCurrentSequenceGenerator;
function generateNext(AI = AI) { // generates the notes based on the sequence
    if (!AI.running) return;
    if (AI.generatedSequence.length < 10) {
        AI.lastGenerationTask = AI.rnn
            .continueSequence(AI.noteSeq, 20, AI.temperature, [AI.chord]) // continues a provided quantized NoteSequence
            .then(genSeq => {
                AI.generatedSequence = AI.generatedSequence.concat(
                    genSeq.notes.map(n => n.pitch)
                );
                setTimeout(AI.generateNext, AI.generationIntervalTime * 1000);
            });
    } else {
        console.log("Here")
        setTimeout(AI.generateNext, AI.generationIntervalTime * 1000);
    }
}

function consumeNext(AI=AI) {
    console.log(`Current Sequence: ${AI.generatedSequence}`)
    if (AI.generatedSequence.length) {
        let note = AI.generatedSequence.shift(); // .shift() removes the first element from an array and returns that removed element
        if (note > 0) {
            console.log(`AI: ${note}`)
            AI.emit("keyDown", note, false); // set human=false 
        }
    }
}
function startSequenceGenerator(AI, notes) {
    AI.running = true;
    AI.lastGenerationTask = Promise.resolve();
    AI.chord = AI.detectChord(notes);
    AI.noteSeq = AI.buildNoteSequence(notes);
    AI.generatedSequence = Math.random() < 0.7 ? _.clone(AI.noteSeq.notes.map(n => n.pitch)) : [];
    let launchWaitTime = AI.getSequenceLaunchWaitTime(notes);
    let playIntervalTime = AI.getSequencePlayIntervalTime(notes);
    AI.generationIntervalTime = playIntervalTime / 2;
    setTimeout(generateNext, launchWaitTime * 1000);
    let consumerId = Tone.Transport.scheduleRepeat(consumeNext, playIntervalTime, Tone.Transport.seconds + launchWaitTime);

    return () => {
        AI.running = false;
        Tone.Transport.clear(consumerId);
    };
}
function updateChord({ add = null, remove = null }) {
    if (add) {
        AI.notes.push({ note: add, time: Tone.now() });
    }
    if (remove && _.some(AI.notes, { note: remove })) {
        _.remove(AI.notes, { note: remove });
    }

    if (stopCurrentSequenceGenerator) {
        stopCurrentSequenceGenerator(AI);
        stopCurrentSequenceGenerator = null;
    }

    // Check if the model is ready to start playing
    if (AI.notes.length && !stopCurrentSequenceGenerator) {
        stopCurrentSequenceGenerator = startSequenceGenerator(AI, _.cloneDeep(AI.notes));
    }
}
