var selectedInstrument = document.getElementById("instrument").value;
// passing a single instrument name loads one instrument and returns the tone.js object
var instrument = SampleLibrary.load({
    instruments: selectedInstrument,
    baseUrl : "/src/sounds/"
});

let sampler = instrument.toMaster() //.connect(reverb); // sound clips used by the piano
sampler.release.value = 1;
let synthFilter = new Tone.Filter(300, 'lowpass').connect(
    new Tone.Gain(0.4).toMaster()
); // just a sound filter to change the sound of the piano
let synthConfig = {
};
let synthsPlaying = {};
