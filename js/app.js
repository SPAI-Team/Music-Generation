const keyboard_container = document.querySelector(".keyboard");
const KEYBOARD = new Keyboard(keyboard_container);
const AI = new AI_Model();

KEYBOARD.on("keyDown", (note, human) => {
    if (human) {
        AI.keyDown(note);
    }
    KEYBOARD._interface.keyDown(note, human);
});

AI.on("keyDown", (note, human) => {
    KEYBOARD._interface.keyDown(note, human);
    KEYBOARD.keyDown(note, human);
});

AI.on("keyUp", (note) => {
    KEYBOARD.keyUp(note);
});
KEYBOARD.on("keyUp", (note) => {
    AI.keyUp(note);
    KEYBOARD._interface.keyUp(note);
});


function generateDummySequence() {
    return AI.rnn.continueSequence(
        AI.buildNoteSequence([
            {
                note: 60,
                time: Tone.now()
            }
        ]),
        20,
        AI.temperature,
        ['Cm']
    );
}
let bufferLoadPromise = new Promise((res) => Tone.Buffer.on("load", res));
Promise.all([bufferLoadPromise, AI.rnn.initialize()]).then(generateDummySequence).then(() => {
    Tone.Transport.start();
    keyboard_container.classList.add("loaded");
    document.querySelector('.loading').remove();
    console.log("Loaded!");
});

StartAudioContext(Tone.context, document.documentElement);