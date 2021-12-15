function start() {
  var maxheight = document.body.scrollHeight;
  document.body.style.backgroundImage = `url(./src/about_top_left.png),
    url(./src/about_top_right.png), url(./src/about_middle_left.png),
    url(./src/about_bottom_right.png)`;
  var scale = 40;
  document.body.style.backgroundRepeat = "no-repeat";
  document.body.style.backgroundAttachment = "scroll";
  document.body.style.backgroundSize = `45%, 25%, 30%, ${scale}%`;
  var image = new Image();
  image.src = "./src/about_bottom_right.png";
  document.body.style.backgroundPosition = `0px 0px, right 0px,0px ${
    maxheight / 2
  }px,right ${maxheight - image.height * (scale / 100)}px`;
}
