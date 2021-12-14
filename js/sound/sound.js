var selectedInstrument = document.getElementById("instrument").value;
var instrument = ""
var chords = []
switch(selectedInstrument) {
    case 0:
        instrument = "piano"
        chords = ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "D#1", "D#2", "D#3", "D#4", "D#5", "D#6", "D#7", "F#1", "F#2", "F#3", "F#4", "F#5", "F#6", "F#7"];
        break;
    case 1:
        instrument = "bass-electric"
        chords = ["A#2", "A#3", "A#4", "A#5", "C#2", "C#3", "C#4", "C#5", "E2", "E3", "E4", "E5", "G2", "G3", "G4", "G5"];
        break;
    case 2:
        instrument = "bassoon"
        chords = ["A3", "C2", "C3", "C4", "E3", "G1", "G2", "G3", "A1", "A2"];
      break;
    case 3:
        instrument = "cello"
        chords = ["E3", "E4", "F2", "F3", "F4", "F#3", "F#4", "G2", "G3", "G4", "G#2", "G#3", "G#4", "A2", "A3", "A4", "A#2", "A#3", "A#4", "B2", "B3", "B4", "C2", "C3", "C4", "C5", "C#3", "C#4", "D2", "D3", "D4", "D#2", "D#3", "D#4", "E2"];
        break;
    case 4:
        instrument = "clarinet"
        chords = ["D3", "D4", "D5", "F2", "F3", "F4", "F#5", "A#2", "A#3", "A#4", "D2"];
        break;
    case 5:
        instrument = "flute"
        chords = ["A5", "C3", "C4", "C5", "C6", "E3", "E4", "E5", "A3", "A4"];
        break;
    case 6:
        instrument = "french-horn"
        chords = ["D2", "D4", "D#1", "F2", "F4", "G1", "A0", "A2", "C1", "C3"];
        break;
    case 7:
        instrument = "guitar-ascoustic"
        chords = ["F3", "F#1", "F#2", "F#3", "G1", "G2", "G3", "G#1", "G#2", "G#3", "A1", "A2", "A3", "A#1", "A#2", "A#3", "B1", "B2", "B3", "C2", "C3", "C4", "C#2", "C#3", "C#4", "D1", "D2", "D3", "D4", "D#1", "D#2", "D#3", "E1", "E2", "E3", "F1", "F2"];
        break;
    case 8:
        instrument = "violin"
        chords = ["A3", "A4", "A5", "A6", "C4", "C5", "C6", "C7", "E4", "E5", "E6", "G4", "G5", "G6"];
        break;
    case 9:
        instrument = "trumpet"
        chords = ["C5", "D4", "D#3", "F2", "F3", "F4", "G3", "A2", "A4", "A#3", "C3"];
        break;
}

// let chords = [
//     "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "D#1", "D#2", "D#3", "D#4", "D#5", "D#6", "D#7", "F#1", "F#2", "F#3", "F#4", "F#5", "F#6", "F#7"
// ];

let filemap = {};
for (let chord of chords) {
    let filepath = `src/sounds/${instrument}/${chord.replace("#", "s")}.mp3`;
    filemap[chord] = filepath;
}
let sampler = new Tone.Sampler(instrument, filemap).toMaster() //.connect(reverb); // sound clips used by the piano
sampler.release.value = 1;
let synthFilter = new Tone.Filter(300, 'lowpass').connect(
    new Tone.Gain(0.4).toMaster()
); // just a sound filter to change the sound of the piano
let synthConfig = {
};
let synthsPlaying = {};
