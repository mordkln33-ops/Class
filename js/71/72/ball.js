const theCanvas = document.querySelector('#theCanvas');

const context = theCanvas.getContext('2d');

function sizeCanvas() {
  theCanvas.width = window.innerWidth;
  theCanvas.height = window.innerHeight;
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);

const radius = 50;
let x = radius + 1;
let y = radius + 1;
let dx = 1;
let dy = 2;

setInterval(() => {
  context.clearRect(0, 0, theCanvas.width, theCanvas.height);
  context.fillStyle = 'red';
  context.beginPath();

  x += dx;
  y += dy;
  if (x < (radius + 1) || x >= window.innerWidth - (radius + 1)) {
    dx = -dx;
  }
  if (y < (radius + 1) || y >= window.innerHeight - (radius + 1)) {
    dy = -dy;
  }


  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}, 1);
