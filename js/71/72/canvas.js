const theCanvas = document.querySelector('#theCanvas');

const context = theCanvas.getContext('2d');

context.lineWidth = 8;
context.strokeRect(49, 49, 155, 106);
context.fillStyle = 'red';
context.fillRect(50, 50, 150, 100);

context.beginPath();
context.lineWidth = 1;
context.moveTo(175, 175);
context.lineTo(200, 200);
context.lineTo(175, 225);
//context.lineTo(175, 175);
context.closePath();
context.stroke();

context.beginPath();
context.strokeStyle = 'yellow';
context.moveTo(175, 175);
context.lineTo(150, 200);
context.lineTo(175, 225);
//context.lineTo(175, 175);
context.closePath();
context.stroke();

context.beginPath();
context.arc(300, 300, 50, 0, Math.PI / 2, true);
context.fill();

//const potato = document.querySelector('#potato');

/*const potato = document.createElement('img');
potato.src = 'x23.png';
/*setTimeout(() => {
  context.drawImage(potato, 0, 0);
}, 1000);* /

potato.onload = () => {
  context.drawImage(potato, 0, 0);
};
potato.onerror = () => {
  console.error('cant load potato');
};*/

const potato = await loadImage('23.png');
context.drawImage(potato, 0, 0);

function loadImage(url) {
  const img = document.createElement('img');
  img.src = url;

  return new Promise((resolve, reject) => {
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      reject(`failed to load img ${url}`);
    };
  });
}

context.font = '48px serif';
context.fillText('Hello world', 10, 50);
