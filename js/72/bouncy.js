const xInput = document.querySelector('#xCoord');
const yInput = document.querySelector('#yCoord');
const ballButton = document.querySelector('#addBall');
const ballColor = document.querySelector('#colorPicker');
const radiusBall = document.querySelector('#size');
const ballSpeed = document.querySelector('#speed');
const ballAngle = document.querySelector('#angle');
const clearBalls = document.querySelector('#clearBalls');
const canvasArea = document.querySelector('#draw');
const context = canvasArea.getContext('2d');
const ballArr = [];
let r = 0;
function sizeCanvas() {
    canvasArea.width = window.innerWidth;
    canvasArea.height = window.innerHeight;
}

sizeCanvas();
window.addEventListener('resize', sizeCanvas);

ballButton.addEventListener('click', addBall);

clearBalls.addEventListener('click', () => {
    ballArr.length = 0;
})
setInterval(function () {
    context.clearRect(0, 0, canvasArea.width, canvasArea.height);
    for (let i = 0; i < ballArr.length; i++) {
        ballArr[i].draw();
    }
}, 10)

function addBall() {
    const ball = {
        color: ballColor.value,
        radius: parseFloat(radiusBall.value),
        startX: parseFloat(xInput.value) + parseFloat(radiusBall.value) + 1,
        startY: parseFloat(yInput.value) + parseFloat(radiusBall.value) + 1,
        xMove: parseFloat(ballAngle.value),
        Ymove: parseFloat(ballSpeed.value),
        bounces: 0,

        draw: function () {
            drawBall(this);
            this.startX += this.xMove;
            this.startY += this.Ymove;
            if (this.startX < (this.radius + 1) || this.startX >= window.innerWidth - (this.radius + 1)) {
                this.xMove = -(this.xMove);

            }
            if (this.startY < (this.radius + 1 + (this.bounces)) || this.startY >= window.innerHeight - (this.radius + 1)) {
                this.Ymove = -(this.Ymove);

            }
            if (this.startY >= window.innerHeight - (this.radius + 1)) {
                this.bounces = this.bounces + 50;
            }
        }
    }
    ballArr.push(ball);
    console.log(ball);
}

function drawBall(ball) {
    context.fillStyle = ball.color;
    context.beginPath();
    context.arc(ball.startX, ball.startY, ball.radius, 0, Math.PI * 2);
    context.fill();
}












// ballButton.addEventListener('click', () => {
//     newBall(ballColor.value, xInput.value, yInput.value, radiusBall.value);
//     // // setInterval(() => {
//     //     // context.clearRect(0, 0, canvasArea.width, canvasArea.height);
//     //     ballArr.forEach(b => {
//     //         addBall(b);
//     //     });


//     // }, 10)

// });
// // setInterval(() => {
// function playBall() {
//     setInterval(() => {
//         context.clearRect(0, 0, canvasArea.width, canvasArea.height);
//         ballArr.forEach(b => {
//             addBall(b);
//         });
//     }, 10)
// }
// function addBall(b) {
//     const radius = parseFloat(b.radius);
//     const color = b.color;
//     b.x += dx;
//     b.y += dy;
//     let x = parseFloat(b.x) + radius + 1;
//     let y = parseFloat(b.y) + radius + 1;


//     // console.log(x, y, radius)


//     context.fillStyle = color;
//     context.beginPath();


//     if (x < (radius + 1) || x >= window.innerWidth - (radius + 1)) {
//         dx = -dx;
//     }
//     if (y < (radius + 1) || y >= window.innerHeight - (radius + 1)) {
//         dy = -dy;
//     }


//     context.arc(x, y, radius, 0, Math.PI * 2);
//     context.fill();
//     // }, 1);
// }

// playBall();

// function newBall(color, x, y, radius) {
//     const ball = {
//         color,
//         x,
//         y,
//         radius
//     }
//     ballArr.push(ball);
//     console.log(ballArr);
// }