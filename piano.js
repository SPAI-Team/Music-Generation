
const MIN_NOTE = 48;
const MAX_NOTE = 84;

// Using the Improv RNN pretrained model from https://github.com/tensorflow/magenta/tree/master/magenta/models/improv_rnn
let rnn = new mm.MusicRNN(
 'https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/chord_pitches_improv' /*magenta*/ 
);

let temperature = 1.1;

let reverb = new Tone.Convolver('https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/hm2_000_ortf_48k.mp3').toMaster(); 
//reverb.wet.value = 0.25; Uncaught TypeError: Cannot read property of undefined
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
}).connect(reverb);
sampler.release.value = 2;


function isAccidental(note) {
  let pc = note % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

function buildKeyboard(container) {
  let nAccidentals = _.range(MIN_NOTE, MAX_NOTE + 1).filter(isAccidental)
    .length;
  let keyWidthPercent = 100 / (MAX_NOTE - MIN_NOTE - nAccidentals + 1);
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

let builtInKeyboard = new AudioKeys({ rows: 2 });
let onScreenKeyboardContainer = document.querySelector('.keyboard');
let onScreenKeyboard = buildKeyboard(onScreenKeyboardContainer);
let machinePlayer = buildKeyboard(
  document.querySelector('.machine-bg .player')
);
let humanPlayer = buildKeyboard(document.querySelector('.human-bg .player'));

let currentSeed = [];
let stopCurrentSequenceGenerator;
let synthFilter = new Tone.Filter(300, 'lowpass').connect(
  new Tone.Gain(0.4).toMaster()
);
let synthConfig = {
  oscillator: { type: 'fattriangle' },
  envelope: { attack: 3, sustain: 1, release: 1 }
};
let synthsPlaying = {};
function humanKeyDown(note, velocity = 0.7) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  let freq = Tone.Frequency(note, 'midi');
  let synth = new Tone.Synth(synthConfig).connect(synthFilter);
  synthsPlaying[note] = synth;
  synth.triggerAttack(freq, Tone.now(), velocity);
  sampler.triggerAttack(freq);
  updateChord({ add: note });
  humanPlayer[note - MIN_NOTE].classList.add('down');
  animatePlay(onScreenKeyboard[note - MIN_NOTE], note, true);
}

function humanKeyUp(note) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  if (synthsPlaying[note]) {
    let synth = synthsPlaying[note];
    synth.triggerRelease();
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

// let tempSlider = new mdc.slider.MDCSlider(
//   document.querySelector('#temperature')
// );
// tempSlider.listen('MDCSlider:change', () => temperature = tempSlider.value);

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


let bufferLoadPromise = new Promise(res => Tone.Buffer.on('load', res));
Promise.all([bufferLoadPromise, rnn.initialize()])
  .then(generateDummySequence)
  .then(() => {
    Tone.Transport.start();
    onScreenKeyboardContainer.classList.add('loaded');
    document.querySelector('.loading').remove();
  });

StartAudioContext(Tone.context, document.documentElement);
