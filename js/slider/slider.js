// temperature slider
var slider = document.getElementById("myRange");
var output = document.getElementById("value");

output.innerHTML = slider.value;

slider.oninput = function() {
    output.innerHTML = this.value;
}

slider.addEventListener("mousemove", function() {
    var x = slider.value;
    var color = "linear-gradient(90deg, rgb(117,252,117)" + x + "%, pink" + x + "%)"
    slider.style.background = color;
    temperature = x;
    print(temperature)
})