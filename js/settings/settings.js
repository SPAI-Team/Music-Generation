const SLIDER = document.getElementById("temperature");
const SHOW_NOTES = document.getElementById("show_note");
SLIDER.addEventListener("mousemove", function () {
    AI.temperature = parseFloat(SLIDER.value);
});


SHOW_NOTES.onclick = (event) => {
    KEYBOARD._interface.show_notes = event.srcElement.checked;
    KEYBOARD._resize();
};
