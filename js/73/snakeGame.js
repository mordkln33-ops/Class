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
const GOMessage = document.querySelector('#gameOver');
const playButton = document.querySelector('#playButton');
const gameTitle = document.querySelector('#gameTitle');
const squares = [];
let snakeLocations = [{
  top: 0,
  bottom: 64,
  left: 0,
  right: 64,
  direction: 'down'
}];
const snakeParts = [];
let currentApple;
let muted = false;
let currentScore = 0;
let gameIsOn;
let onBoard = false;
let drawSnake = true;
let interval = 400;



const gameOverScore = function (myscore) {
  const cardTitle = document.createElement('h2');
  cardTitle.innerText = 'Game Over';
  GOMessage.appendChild(cardTitle);
  const card = document.createElement('p');
  card.innerText = `You scored ${myscore} points!`;
  GOMessage.appendChild(card);
  GOMessage.style.display = 'block';
  setTimeout(() => {
    GOMessage.style.display = 'none';
  }, 2000)
};

const apple = {
  top: 0,
  bottom: 64,
  left: 0,
  right: 64,
  square: 0,
  // onBoard: false,
  src: 'assets/images/apple_3.png',
  draw: function () {
    const app = document.createElement('img');
    app.src = this.src;
    app.onload = () => {
      context.drawImage(app, this.left, this.top);
      // onBoard = true;
    }
  },
  generate: function () {
    while (!onBoard) {
      const sq = Math.floor(Math.random() * squares.length);
      if (squares[sq].status == "empty") {
        this.top = squares[sq].top;
        this.bottom = squares[sq].bottom;
        this.left = squares[sq].left;
        this.right = squares[sq].right;
        this.square = sq;
        squares[sq].status = "apple";
        onBoard = true;
        currentApple = sq;
      }
    }
  },
  newApple: function () {
    if (!onBoard) {
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
  srcOU: 'assets/images/head_2.png',
  srcOD: 'assets/images/head_2_d.png',
  srcOR: 'assets/images/head_2_r.png',
  srcOL: 'assets/images/head_2_l.png',
  square: 0,
  direction: 'down',
  draw: function () {
    const snake = document.createElement('img');

    switch (this.direction) {
      case 'down':
        snake.src = this.srcD;
        if (this.square == currentApple) {
          snake.src = this.srcOD;
        }
        break;
      case 'up':
        snake.src = this.srcU;
        if (this.square == currentApple) {
          snake.src = this.srcOU;
        }
        break;
      case 'left':
        snake.src = this.srcL;
        if (this.square == currentApple) {
          snake.src = this.srcOL;
        }
        break;
      case 'right':
        snake.src = this.srcR;
        if (this.square == currentApple) {
          snake.src = this.srcOR;
        }
        break;
    }
    snake.onload = () => {
      context.drawImage(snake, this.left, this.top);
    }
    if (squares[this.square].status == "snake") {
      clearInterval(gameIsOn);
      if (!muted) {
        crash.play();
      }
      gameOverScore(currentScore);
      drawSnake = false;
    }
    squares[this.square].status = 'snake';
  },
  move: function () {
    context.clearRect(this.left, this.top, SNAKE_SIZE, SNAKE_SIZE);

    switch (this.direction) {
      case 'right':
        if (this.right + SNAKE_SIZE > parseFloat(theCanvas.width)) {
          clearInterval(gameIsOn);
          if (!muted) {
            crash.play();
          }
          gameOverScore(currentScore);
          drawSnake = false;
          break;
        }
        this.left = this.right;
        this.right = this.right + SNAKE_SIZE;
        squares[this.square].status = 'empty';
        this.square = findSquareNum(this.top, this.left);
        break;
      case 'left':
        if (this.left - SNAKE_SIZE < 0) {
          clearInterval(gameIsOn);
          if (!muted) {
            crash.play();
          }
          gameOverScore(currentScore);
          drawSnake = false;
          break;
        }
        this.right = this.left;
        this.left = this.left - SNAKE_SIZE;
        squares[this.square].status = 'empty';
        this.square = findSquareNum(this.top, this.left);
        break;
      case 'up':
        if ((this.top - SNAKE_SIZE) < 0) {
          clearInterval(gameIsOn);
          if (!muted) {
            crash.play();
          }
          gameOverScore(currentScore);
          drawSnake = false;
          break;
        }
        this.bottom = this.top;
        this.top = this.top - SNAKE_SIZE;
        squares[this.square].status = 'empty';
        this.square = findSquareNum(this.top, this.left);
        break;
      case 'down':
        if ((this.bottom + SNAKE_SIZE) > (parseFloat(theCanvas.height))) {
          clearInterval(gameIsOn);
          if (!muted) {
            crash.play();
          }
          gameOverScore(currentScore);
          drawSnake = false;
          break;
        }
        this.top = this.bottom;
        this.bottom = this.bottom + SNAKE_SIZE;
        squares[this.square].status = 'empty';
        this.square = findSquareNum(this.top, this.left);
        break;
    }
    if (this.square == apple.square) {
      onBoard = false;
      if (!muted) {
        chomp.play();
        score.play();
      }
      currentScore += 10;
      scoreCard.textContent = `Score: ${currentScore}`;
      const part = new SnakePart(this.top, this.bottom, this.left, this.right, this.direction);
      snakeParts.push(part);
      interval = interval * .95;
      clearInterval(gameIsOn);
      gameIsOn = setInterval(game, interval);
    }
    // this.draw();
    const loc = new Locations(this.top, this.bottom, this.left, this.right, this.direction);
    snakeLocations.push(loc);

  }
}
const tail = {
  top: 0,
  bottom: 64,
  left: 0,
  right: 64,
  direction: 'down',
  square: 0,
  srcU: 'assets/images/tail.png',
  srcD: 'assets/images/tail_d.png',
  srcL: 'assets/images/tail_l.png',
  srcR: 'assets/images/tail_r.png',
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
  move: function (top, bottom, left, right, direction) {
    context.clearRect(this.left, this.top, SNAKE_SIZE, SNAKE_SIZE);
    squares[this.square].status = "empty";
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
    this.direction = direction;
    this.square = findSquareNum(this.top, this.left);
    squares[this.square].status = 'snake';
    // this.draw();
  }
};
class SnakePart {
  constructor(top, bottom, left, right, direction) {
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
    this.nextDirection = direction;
    this.direction = direction;
    this.change = false;
    this.srcV = 'assets/images/body_3.png';
    this.srcH = 'assets/images/body_3_h.png';
    this.square = 0;
    this.draw = function () {
      const snakePart = document.createElement('img');

      switch (this.direction) {
        case 'down':
          // snakePart.src = this.srcV;
          if (!this.change) { snakePart.src = this.srcV; };
          if (this.nextDirection == 'left') { snakePart.src = 'assets/images/turn_3.png'; };
          if (this.nextDirection == 'right') { snakePart.src = 'assets/images/turn_2.png'; };
          break;
        case 'up':
          // snakePart.src = this.srcV;
          if (!this.change) { snakePart.src = this.srcV; };
          if (this.nextDirection == 'left') { snakePart.src = 'assets/images/turn_4.png'; };
          if (this.nextDirection == 'right') { snakePart.src = 'assets/images/turn.png'; };
          break;
        case 'left':
          // snakePart.src = this.srcH;
          if (!this.change) { snakePart.src = this.srcH; };
          if (this.nextDirection == 'up') { snakePart.src = 'assets/images/turn_2.png'; };
          if (this.nextDirection == 'down') { snakePart.src = 'assets/images/turn.png'; };
          break;
        case 'right':
          // snakePart.src = this.srcH;
          if (!this.change) { snakePart.src = this.srcH; };
          if (this.nextDirection == 'up') { snakePart.src = 'assets/images/turn_3.png'; };
          if (this.nextDirection == 'down') { snakePart.src = 'assets/images/turn_4.png'; };
          break;
      }
      this.square = findSquareNum(this.top, this.left);
      squares[this.square].status = 'snake';
      snakePart.onload = () => {
        context.drawImage(snakePart, this.left, this.top);
      }
    };
    this.move = function (top, bottom, left, right, direction, nextDirection) {
      this.change = false;
      context.clearRect(this.left, this.top, SNAKE_SIZE, SNAKE_SIZE);
      squares[this.square].status = "empty";
      this.top = top;
      this.bottom = bottom;
      this.left = left;
      this.right = right;
      this.nextDirection = nextDirection;
      this.direction = direction;
      if (this.nextDirection != this.direction) {
        this.change = true;
      }
      this.square = findSquareNum(this.top, this.left);
      squares[this.square].status = 'snake';
      console.log(this.direction);
      console.log(this.nextDirection);
      // this.draw();
    }
  }
};

class Square {
  constructor(top, bottom, left, right) {
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;

    this.status = 'empty';
  }
};

function moveSnakeParts() {
  let j;
  let i;
  for (i = snakeParts.length - 1, j = snakeLocations.length - 2; i >= 0; i--, j--) {
    snakeParts[i].move(snakeLocations[j].top, snakeLocations[j].bottom, snakeLocations[j].left, snakeLocations[j].right, snakeLocations[j].direction, snakeLocations[j + 1].direction);
  }
  tail.move(snakeLocations[j].top, snakeLocations[j].bottom, snakeLocations[j].left, snakeLocations[j].right, snakeLocations[j].direction);
};
class Locations {
  constructor(top, bottom, left, right, direction) {
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
    this.direction = direction;
  }
};
function sizeCanvas() {
  theCanvas.width = window.innerWidth - (window.innerWidth % SNAKE_SIZE);
  theCanvas.height = window.innerHeight - (window.innerHeight % SNAKE_SIZE);
};

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

// playGame();

function game() {
  snakeHead.move();

  apple.newApple();
  if (drawSnake) {
    moveSnakeParts();
  };
  snakeHead.draw();
  for (let i = snakeParts.length - 1; i >= 0; i--) {
    snakeParts[i].draw();
  }
  tail.draw();
};

playButton.addEventListener('click', playGame);
function playGame() {
  if (!muted) {
    music.play();
  }
  gameTitle.style.opacity = '50%';
  snakeLocations = [{
    top: 0,
    bottom: 64,
    left: 0,
    right: 64,
    direction: 'down'
  }];
  interval = 400;
  fillSquaresArr();
  drawSnake = true;
  snakeParts.length = 0;
  GOMessage.innerHTML = '';
  currentScore = 0;
  scoreCard.textContent = `Score: ${currentScore}`
  clearInterval(gameIsOn);
  onBoard = false;
  context.clearRect(0, 0, theCanvas.width, theCanvas.height);
  positionSetter(snakeHead, squares[0]);
  // positionSetter(tail, squares[0]);
  snakeHead.direction = 'down';
  snakeHead.draw();
  // snakeHead.move();
  // snakeHead.draw();
  // moveSnakeParts();
  // tail.draw();
  gameIsOn = setInterval(game, interval);
};
// const playGame = setInterval(game, 500)

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
});

unMute.addEventListener('click', () => {
  unMute.style.display = 'none';
  mute.style.display = 'block';
  music.play();
  muted = false;
});

function fillSquaresArr() {
  squares.length = 0;
  const columns = parseFloat(theCanvas.width) / SNAKE_SIZE;
  const rows = parseFloat(theCanvas.height) / SNAKE_SIZE;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const sq = new Square(i * SNAKE_SIZE, (i + 1) * SNAKE_SIZE, j * SNAKE_SIZE, (j + 1) * SNAKE_SIZE)
      squares.push(sq);
    }

  }
  console.log(squares);
};

function findSquareNum(top, left) {

  const columns = parseFloat(theCanvas.width) / SNAKE_SIZE;
  // const rows = parseFloat(theCanvas.height) / SNAKE_SIZE;

  const c = left / SNAKE_SIZE;
  const r = top / SNAKE_SIZE;

  const num = r * columns + c;
  // console.log(num);
  return num;
};

crash.addEventListener('ended', () => {
  gameOver.play();
});

function positionSetter(obj, square) {
  obj.top = square.top;
  obj.bottom = square.bottom;
  obj.left = square.left;
  obj.right = square.right;
};

