// const colors = ['red', 'white', 'blue'];
// let index = 0;

let interval;

document.querySelector('#start').addEventListener('click', e => {
  if (! interval) {
    interval = setInterval(() => {
      /*document.body.style.color = colors[index++];
      if (index === colors.length) {
        index = 0;
      }
      document.body.style.backgroundColor = colors[index];*/

      document.body.style.color = getRandomColor();
      document.body.style.backgroundColor = getRandomColor();

    }, 1000);

    e.target.textContent = 'stop';
  } else {
    clearInterval(interval);
    interval = null;
    e.target.textContent = 'start';
  }
});

function getRandomColor() {
  /*const color = Math.floor(Math.random() * 16777217);
  const hex = color.toString('16').padStart(6, '0');

  console.log(`#${hex}`);

  return `#${hex}`;*/

  return `#${Math.floor(Math.random() * 16777217).toString('16').padStart(6, '0')}`;
}

/*function getRandomColor() {
  let r = getColorPart();
  let g = getColorPart();
  let b = getColorPart();
  return `rgb(${r}, ${g}, ${b})`;
}

function getColorPart() {
  return Math.floor(Math.random() * 256);
}*/
