const theCanvas = document.querySelector('#theCanvas');
const context = theCanvas.getContext('2d');
const SNAKE_SIZE = 64;
const mute = document.querySelector('#mute');
const unMute = document.querySelector('#unMute');
const chomp = new Audio('assets/sounds/01_apple_chomp.mp3');
const score = new Audio('assets/sounds/02_happy_score.mp3');
const crash = new Audio('assets/sounds/03_crash.mp3');
const gameOver = new Audio('assets/sounds/04_game_over_sad.mp3');
const music = new Audio('assets/sounds/13_gameplay_music_loop.mp3');
const scoreCard = document.querySelector('#score');
const squares = [];
let muted = false;
let currentScore = 0;


const apple = {
  top: 0,
  bottom: 64,
  left: 0,
  right: 64,
  square: 0,
  onBoard: false,
  src: 'assets/images/apple_1.png',
  draw: function () {
    const app = document.createElement('img');
    app.src = this.src;
    app.onload = () => {
      context.drawImage(app, this.left, this.top);
      this.onBoard = true;
    }
  },
  generate: function () {
    const sq = Math.floor(Math.random() * squares.length);
    this.top = squares[sq].top;
    this.bottom = squares[sq].bottom;
    this.left = squares[sq].left;
    this.right = squares[sq].right;
    this.square = sq;
    squares[sq].status = 'apple'
  },
  newApple: function () {
    if (!this.onBoard) {
      this.generate();
      this.draw();
    }
  },
  regen: function () {
    // if(){

    // }
  }
}
const snakeHead = {
  top: 0,
  bottom: 64,
  left: 0,
  right: 64,
  srcU: 'assets/images/head_1.png',
  srcD: 'assets/images/head_1_d.png',
  srcL: 'assets/images/head_1_l.png',
  srcR: 'assets/images/head_1_r.png',
  square: 0,
  direction: 'down',
  draw: function () {
    const snake = document.createElement('img');

    switch (this.direction) {
      case 'down':
        snake.src = this.srcD;
        break;
      case 'up':
        snake.src = this.srcU;
        break;
      case 'left':
        snake.src = this.srcL;
        break;
      case 'right':
        snake.src = this.srcR;
        break;
    }
    snake.onload = () => {
      context.drawImage(snake, this.left, this.top);
    }
  },
  move: function () {
    context.clearRect(this.left, this.top, SNAKE_SIZE, SNAKE_SIZE);
    switch (this.direction) {
      case 'right':
        this.left = this.right;
        this.right = this.right + SNAKE_SIZE;
        squares[this.square].status = 'empty';
        this.square = findSquareNum(this.top, this.left);
        squares[this.square].status = 'snake';
        break;
      case 'left':
        this.right = this.left;
        this.left = this.left - SNAKE_SIZE;
        squares[this.square].status = 'empty';
        this.square = findSquareNum(this.top, this.left);
        squares[this.square].status = 'snake';
        break;
      case 'up':
        this.bottom = this.top;
        this.top = this.top - SNAKE_SIZE;
        squares[this.square].status = 'empty';
        this.square = findSquareNum(this.top, this.left);
        squares[this.square].status = 'snake';
        break;
      case 'down':
        this.top = this.bottom;
        this.bottom = this.bottom + SNAKE_SIZE;
        squares[this.square].status = 'empty';
        this.square = findSquareNum(this.top, this.left);
        squares[this.square].status = 'snake';
        break;
    }
    if (this.square == apple.square) {
      apple.onBoard = false;
      if (!muted) {
        chomp.play();
        score.play();
      }
      currentScore += 10;
      scoreCard.textContent = `Score: ${currentScore}`;
    }
    this.draw();
  }
}


class Square {
  constructor(top, bottom, left, right) {
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;

    this.status = 'empty';
  }
}

function sizeCanvas() {
  theCanvas.width = window.innerWidth - (window.innerWidth % SNAKE_SIZE);
  theCanvas.height = window.innerHeight - (window.innerHeight % SNAKE_SIZE);
}

sizeCanvas();
console.log(theCanvas.width, theCanvas.height)
fillSquaresArr();

window.addEventListener('resize', () => {
  sizeCanvas();
  fillSquaresArr();
});


console.log(snakeHead);
snakeHead.draw();
music.loop = true;
music.volume = 0.25;
if (!muted) {
  music.play();
}
setInterval(() => {
  snakeHead.move();
  apple.newApple();
}, 500);


window.addEventListener('keydown', e => {
  switch (e.key) {
    case 'ArrowUp':
      snakeHead.direction = 'up';
      break;
    case 'ArrowDown':
      snakeHead.direction = 'down';
      break;
    case 'ArrowLeft':
      snakeHead.direction = 'left';
      break;
    case 'ArrowRight':
      snakeHead.direction = 'right';
      break;
    default:
      console.log(`${e.key} not processed`);
  }
});

mute.addEventListener('click', () => {
  mute.style.display = 'none';
  unMute.style.display = 'block';
  music.pause();
  muted = true;
})

unMute.addEventListener('click', () => {
  unMute.style.display = 'none';
  mute.style.display = 'block';
  music.play();
  muted = false;
})

function fillSquaresArr() {
  const columns = parseFloat(theCanvas.width) / SNAKE_SIZE;
  const rows = parseFloat(theCanvas.height) / SNAKE_SIZE;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const sq = new Square(i * SNAKE_SIZE, (i + 1) * SNAKE_SIZE, j * SNAKE_SIZE, (j + 1) * SNAKE_SIZE)
      squares.push(sq);
    }

  }
  console.log(squares);
}

function findSquareNum(top, left) {

  const columns = parseFloat(theCanvas.width) / SNAKE_SIZE;
  const rows = parseFloat(theCanvas.height) / SNAKE_SIZE;

  const c = left / SNAKE_SIZE;
  const r = top / SNAKE_SIZE;

  const num = r * columns + c;
  console.log(num);
  return num;
}