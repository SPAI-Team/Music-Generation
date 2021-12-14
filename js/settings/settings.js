const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]')); // Enable popover text
const popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    console.log(popoverTriggerEl)
    return new bootstrap.Popover(popoverTriggerEl);
});


const SETTINGS = document.getElementById("settings");
const SLIDER = document.getElementById("temperature");
const SHOW_NOTES = document.getElementById("show_note");
const SHOW_BINDINGS = document.getElementById("show_bindings");

const slider_func = () => {
    AI.temperature = parseFloat(SLIDER.value);
};
const show_notes_func = (event) => {
    KEYBOARD._interface.show_notes = event.srcElement.checked;
    KEYBOARD._resize();
};

const show_bindings_func = (event) => {
    KEYBOARD._interface.show_bindings = event.srcElement.checked;
    KEYBOARD._resize();
};


const reset = () => {
    slider_func();
    KEYBOARD._interface.show_notes = false;
    KEYBOARD._resize();
}

const test = () => {
    console.log("yeet");
};

SLIDER.onchange = slider_func;
SHOW_NOTES.onchange = show_notes_func;
SHOW_BINDINGS.onchange = show_bindings_func;

SETTINGS.onreset = reset

