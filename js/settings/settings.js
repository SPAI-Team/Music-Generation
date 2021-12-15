const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]')); // Enable popover text
const popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
});


const SETTINGS = document.getElementById("settings");
const TEMP_SLIDER = document.getElementById("temperature");
const STEP_SLIDER = document.getElementById("steps");
const TIMER_SLIDER = document.getElementById("start_time");
const SHOW_NOTES = document.getElementById("show_note");
const SHOW_BINDINGS = document.getElementById("show_bindings");

const temp_slider_func = () => {
    AI.temperature = parseFloat(TEMP_SLIDER.value);
};

const step_slider_func = () => {
    AI.steps = parseInt(STEP_SLIDER.value);
};

const timer_slider_func = () => {
    AI.launchWaitTime = parseFloat(TIMER_SLIDER.value);
}

const show_notes_func = (event) => {
    KEYBOARD._interface.show_notes = event.srcElement.checked;
    KEYBOARD._resize();
};

const show_bindings_func = (event) => {
    KEYBOARD._interface.show_bindings = event.srcElement.checked;
    KEYBOARD._resize();
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent)) {
    SHOW_BINDINGS.checked = false;
    KEYBOARD._interface.show_bindings = false;
    KEYBOARD._resize();
}


const reset = () => {
    temp_slider_func();
    step_slider_func();
    timer_slider_func();
    KEYBOARD._interface.show_notes = false;
    KEYBOARD._resize();
}


TEMP_SLIDER.onchange = temp_slider_func;
STEP_SLIDER.onchange = step_slider_func;
SHOW_NOTES.onchange = show_notes_func;
SHOW_BINDINGS.onchange = show_bindings_func;

SETTINGS.onreset = reset

