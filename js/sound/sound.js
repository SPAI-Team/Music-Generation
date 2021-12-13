let chords = [
    "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "D#1", "D#2", "D#3", "D#4", "D#5", "D#6", "D#7", "F#1", "F#2", "F#3", "F#4", "F#5", "F#6", "F#7"
];

let filemap = {};
for (let chord of chords) {
    
    let filepath = `src/sounds/${chord.replace("#", "s")}.mp3`;
    filemap[chord] = filepath;
}
let sampler = new Tone.Sampler(filemap).toMaster() //.connect(reverb); // sound clips used by the piano
sampler.release.value = 1;
let synthFilter = new Tone.Filter(300, 'lowpass').connect(
    new Tone.Gain(0.4).toMaster()
); // just a sound filter to change the sound of the piano
let synthConfig = {
};
let synthsPlaying = {};
