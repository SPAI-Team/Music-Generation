const MIN_NOTE = 48; // should refer to the MIDI note number
const MAX_NOTE = 84;

// Using the Improv RNN pretrained model from  
let rnn = new mm.MusicRNN(
  'https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/chord_pitches_improv'
  // 'http://download.magenta.tensorflow.org/models/performance_with_dynamics.mag'
);

let temperature = 1.1; // hyperpameter of the model, decides how random the model output is

let reverb = new Tone.Convolver('https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/hm2_000_ortf_48k.mp3').toMaster();
//reverb.wet.value = 0.25;
let sampler = new Tone.Sampler({
  C3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-c3.mp3',
  'D#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-ds3.mp3',
  'F#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-fs3.mp3',
  A3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-a3.mp3',
  C4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-c4.mp3',
  'D#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-ds4.mp3',
  'F#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-fs4.mp3',
  A4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-a4.mp3',
  C5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-c5.mp3',
  'D#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-ds5.mp3',
  'F#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-fs5.mp3',
  A5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-a5.mp3'
}).connect(reverb); // sound clips used by the piano
sampler.release.value = 2;

let builtInKeyboard = new AudioKeys({ rows: 2 }); // audiokeys is a library that lets you use pc keyboard as a piano keyboard
let onScreenKeyboardContainer = document.querySelector('.keyboard');
let onScreenKeyboard = buildKeyboard(onScreenKeyboardContainer);
let machinePlayer = buildKeyboard(
  document.querySelector('.machine-bg .player')
); // a separate keyboard for the ai to play
let humanPlayer = buildKeyboard(document.querySelector('.human-bg .player'));

let currentSeed = [];
let stopCurrentSequenceGenerator;
let synthFilter = new Tone.Filter(300, 'lowpass').connect(
  new Tone.Gain(0.4).toMaster()
); // just a sound filter to change the sound of the piano
let synthConfig = {
  oscillator: { type: 'fattriangle' },
  envelope: { attack: 3, sustain: 1, release: 1 }
};
let synthsPlaying = {};

function isAccidental(note) { // used when building the piano to see which are the accidental notes
  let pc = note % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

function buildKeyboard(container) { // dynamically generates the keyboard 
  let nAccidentals = _.range(MIN_NOTE, MAX_NOTE + 1).filter(isAccidental)
    .length;
  let keyWidthPercent = 100 / (MAX_NOTE - MIN_NOTE - nAccidentals + 1); // calculate width of key
  let keyInnerWidthPercent =
    100 / (MAX_NOTE - MIN_NOTE - nAccidentals + 1) - 0.5;
  let gapPercent = keyWidthPercent - keyInnerWidthPercent;
  let accumulatedWidth = 0;
  return _.range(MIN_NOTE, MAX_NOTE + 1).map(note => {
    let accidental = isAccidental(note);
    let key = document.createElement('div');
    key.classList.add('key');
    if (accidental) {
      key.classList.add('accidental');
      key.style.left = `${accumulatedWidth -
        gapPercent -
        (keyWidthPercent / 2 - gapPercent) / 2}%`;
      key.style.width = `${keyWidthPercent / 2}%`;
    } else {
      key.style.left = `${accumulatedWidth}%`;
      key.style.width = `${keyInnerWidthPercent}%`;
    }
    container.appendChild(key);
    if (!accidental) accumulatedWidth += keyWidthPercent;
    return key;
  });
}

function getSeedIntervals(seed) { 
  let intervals = [];
  for (let i = 0; i < seed.length - 1; i++) {
    let rawInterval = seed[i + 1].time - seed[i].time;
    let measure = _.minBy(['8n', '4n'], subdiv => // returns the minimum value of an array, after mapping each element to a value using the provided function
      // subdiv --> 16th note
      Math.abs(rawInterval - Tone.Time(subdiv).toSeconds())
    );
    intervals.push(Tone.Time(measure).toSeconds());
  }
  return intervals;
}

function getSequenceLaunchWaitTime(seed) {
  if (seed.length <= 1) {
    return 1;
  }
  let intervals = getSeedIntervals(seed);
  let maxInterval = _.max(intervals);
  return maxInterval * 2;
}

function getSequencePlayIntervalTime(seed) {
  if (seed.length <= 1) {
    return Tone.Time('8n').toSeconds(); // Tone.Time is a primitive type for encoding Time values 
    // (1n, 2n, 4n, 8n = whole note, half note, quarter note, eighth note respectively)
  }
  let intervals = getSeedIntervals(seed).sort();
  return _.first(intervals);
}

function detectChord(notes) {
//   console.log(notes);
//   notes = notes.map(n => Tonal.Note.pc(Tonal.Note.fromMidi(n.note))).sort();
//   return Tonal.PcSet.modes(notes)
//     .map((mode, i) => {
//       const tonic = Tonal.Note.name(notes[i]);
//       const names = Tonal.Dictionary.chord.names(mode);
//       return names.length ? tonic + names[0] : null;
//     })
//     .filter(x => x);
    return Tonal.Chord.detect(notes); // based on a list of notes, detect the chord
}

function buildNoteSequence(seed) { // NoteSequence is the way data is sent to the model
  return mm.sequences.quantizeNoteSequence(
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

function startSequenceGenerator(seed) {
  let running = true,
    lastGenerationTask = Promise.resolve();

  let chords = detectChord(seed);
  let chord = _.first(chords) || 'CM';
  let seedSeq = buildNoteSequence(seed);
  let generatedSequence =
    Math.random() < 0.7 ? _.clone(seedSeq.notes.map(n => n.pitch)) : [];
  let launchWaitTime = getSequenceLaunchWaitTime(seed);
  let playIntervalTime = getSequencePlayIntervalTime(seed); // time interval between two notes
  let generationIntervalTime = playIntervalTime / 2;

  function generateNext() { // generates the notes based on the sequence
    if (!running) return;
    if (generatedSequence.length < 10) {
       lastGenerationTask = rnn
        .continueSequence(seedSeq, 20, temperature, [chord]) // continues a provided quantized NoteSequence
        .then(genSeq => {
          generatedSequence = generatedSequence.concat(
            genSeq.notes.map(n => n.pitch)
          );
          setTimeout(generateNext, generationIntervalTime * 1000);
        });
    } else {
      setTimeout(generateNext, generationIntervalTime * 1000);
    }
  }

  function consumeNext(time) {
    if (generatedSequence.length) {
      let note = generatedSequence.shift(); // .shift() removes the first element from an array and returns that removed element
      if (note > 0) {
        machineKeyDown(note, time);
      }
    }
  }

  setTimeout(generateNext, launchWaitTime * 1000);
  let consumerId = Tone.Transport.scheduleRepeat( // schedule a repeated event along the timeline, the event will fire at the interval starting at the startTime and for the specified duration
    consumeNext, // the callback to invoke
    playIntervalTime, // start time
    Tone.Transport.seconds + launchWaitTime // duration
  );

  return () => {
    running = false;
    Tone.Transport.clear(consumerId);
  };
}

function updateChord({ add = null, remove = null }) {
  if (add) {
    currentSeed.push({ note: add, time: Tone.now() });
  }
  if (remove && _.some(currentSeed, { note: remove })) {
    _.remove(currentSeed, { note: remove });
  }

  if (stopCurrentSequenceGenerator) {
    stopCurrentSequenceGenerator();
    stopCurrentSequenceGenerator = null;
  }

  // the model starts playing here
  // if there is some input to send to the model (.length)
  // and nothing telling it to stop
  if (currentSeed.length && !stopCurrentSequenceGenerator) { 
    resetState = true;
    stopCurrentSequenceGenerator = startSequenceGenerator(
      _.cloneDeep(currentSeed)
    ); // then start the ai generation
  }
}

function humanKeyDown(note, velocity = 0.7) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  let freq = Tone.Frequency(note, 'midi');
  let synth = new Tone.Synth(synthConfig).connect(synthFilter);
  synthsPlaying[note] = synth;
  synth.triggerAttack(freq, Tone.now(), velocity); // play the note [note;time;velocity(how "loud" the note will be triggered)]
  sampler.triggerAttack(freq);
  updateChord({ add: note }); // add note to chord
  humanPlayer[note - MIN_NOTE].classList.add('down');
  animatePlay(onScreenKeyboard[note - MIN_NOTE], note, true);
}

function humanKeyUp(note) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  if (synthsPlaying[note]) {
    let synth = synthsPlaying[note];
    synth.triggerRelease(); // stop playing the note [time]
    setTimeout(() => synth.dispose(), 2000);
    synthsPlaying[note] = null;
  }
  updateChord({ remove: note });
  humanPlayer[note - MIN_NOTE].classList.remove('down');
}

function machineKeyDown(note, time) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  sampler.triggerAttack(Tone.Frequency(note, 'midi'));
  animatePlay(onScreenKeyboard[note - MIN_NOTE], note, false);
  animateMachine(machinePlayer[note - MIN_NOTE]);
}

function animatePlay(keyEl, note, isHuman) {
  let sourceColor = isHuman ? '#1E88E5' : '#E91E63';
  let targetColor = isAccidental(note) ? 'black' : 'white';
  keyEl.animate(
    [{ backgroundColor: sourceColor }, { backgroundColor: targetColor }],
    { duration: 700, easing: 'ease-out' }
  );
}
function animateMachine(keyEl) {
  keyEl.animate([{ opacity: 0.9 }, { opacity: 0 }], {
    duration: 700,
    easing: 'ease-out'
  });
}

// Computer keyboard controls

builtInKeyboard.down(note => {
  humanKeyDown(note.note);
  hideUI();
});
builtInKeyboard.up(note => humanKeyUp(note.note));

// MIDI Controls

WebMidi.enable(err => {
  if (err) {
    console.error('WebMidi could not be enabled', err);
    return;
  }
  document.querySelector('.midi-not-supported').style.display = 'none';

  let withInputsMsg = document.querySelector('.midi-supported-with-inputs');
  let noInputsMsg = document.querySelector('.midi-supported-no-inputs');
  let selector = document.querySelector('#midi-inputs');
  let activeInput;

  function onInputsChange() {
    if (WebMidi.inputs.length === 0) {
      withInputsMsg.style.display = 'none';
      noInputsMsg.style.display = 'block';
      onActiveInputChange(null);
    } else {
      noInputsMsg.style.display = 'none';
      withInputsMsg.style.display = 'block';
      while (selector.firstChild) {
        selector.firstChild.remove();
      }
      for (let input of WebMidi.inputs) {
        let option = document.createElement('option');
        option.value = input.id;
        option.innerText = input.name;
        selector.appendChild(option);
      }
      onActiveInputChange(WebMidi.inputs[0].id);
    }
  }

  function onActiveInputChange(id) {
    if (activeInput) {
      activeInput.removeListener();
    }
    let input = WebMidi.getInputById(id);
    input.addListener('noteon', 'all', e => {
      humanKeyDown(e.note.number, e.velocity);
      hideUI();
    });
    input.addListener('noteoff', 'all', e => humanKeyUp(e.note.number));
    for (let option of Array.from(selector.children)) {
      option.selected = option.value === id;
    }
    activeInput = input;
  }

  onInputsChange();
  WebMidi.addListener('connected', onInputsChange);
  WebMidi.addListener('disconnected', onInputsChange);
  selector.addEventListener('change', evt =>
    onActiveInputChange(evt.target.value)
  );
});

// Mouse & touch Controls

let pointedNotes = new Set();

function updateTouchedNotes(evt) {
  let touchedNotes = new Set();
  for (let touch of Array.from(evt.touches)) {
    let element = document.elementFromPoint(touch.clientX, touch.clientY);
    let keyIndex = onScreenKeyboard.indexOf(element);
    if (keyIndex >= 0) {
      touchedNotes.add(MIN_NOTE + keyIndex);
      if (!evt.defaultPrevented) {
        evt.preventDefault();
      }
    }
  }
  for (let note of pointedNotes) {
    if (!touchedNotes.has(note)) {
      humanKeyUp(note);
      pointedNotes.delete(note);
    }
  }
  for (let note of touchedNotes) {
    if (!pointedNotes.has(note)) {
      humanKeyDown(note);
      pointedNotes.add(note);
    }
  }
}

onScreenKeyboard.forEach((noteEl, index) => {
  noteEl.addEventListener('mousedown', evt => {
    humanKeyDown(MIN_NOTE + index);
    pointedNotes.add(MIN_NOTE + index);
    evt.preventDefault();
  });
  noteEl.addEventListener('mouseover', () => {
    if (pointedNotes.size && !pointedNotes.has(MIN_NOTE + index)) {
      humanKeyDown(MIN_NOTE + index);
      pointedNotes.add(MIN_NOTE + index);
    }
  });
});
document.documentElement.addEventListener('mouseup', () => {
  pointedNotes.forEach(n => humanKeyUp(n));
  pointedNotes.clear();
});
document.documentElement.addEventListener('touchstart', updateTouchedNotes);
document.documentElement.addEventListener('touchmove', updateTouchedNotes);
document.documentElement.addEventListener('touchend', updateTouchedNotes);

// Temperature control


// Controls hiding

let container = document.querySelector('.container');

function hideUI() {
  container.classList.add('ui-hidden');
}
let scheduleHideUI = _.debounce(hideUI, 5000);
container.addEventListener('mousemove', () => {
  container.classList.remove('ui-hidden');
  scheduleHideUI();
});
container.addEventListener('touchstart', () => {
  container.classList.remove('ui-hidden');
  scheduleHideUI();
});

// Startup

function generateDummySequence() {
  // Generate a throwaway sequence to get the RNN loaded so it doesn't
  // cause jank later.
  return rnn.continueSequence(
    buildNoteSequence([{ note: 60, time: Tone.now() }]),
    20,
    temperature,
    ['Cm']
  );
} 

let bufferLoadPromise = new Promise(res => Tone.Buffer.on('load', res));
Promise.all([bufferLoadPromise, rnn.initialize()])
  .then(generateDummySequence)
  .then(() => {
    Tone.Transport.start();
    onScreenKeyboardContainer.classList.add('loaded');
    document.querySelector('.loading').remove();
  });

StartAudioContext(Tone.context, document.documentElement);
