'use strict';

let x = 5;
const theButton = document.querySelector('#theButton');
const theSpan = document.querySelector('#theSpan');

let clicks = 0;
/*function handleButtonClick() {
  //console.log(`Button was clicked ${++clicks} times`);
  theSpan.textContent = ++clicks;
}

theButton.addEventListener('click', handleButtonClick);*/

/*theButton.addEventListener('click', function (e) {
  console.log(e);
  theSpan.textContent = ++clicks;
});*/

//theButton.addEventListener('click', () => theSpan.textContent = ++clicks);

theButton.addEventListener('click', e => {
  console.log(e);
  theSpan.textContent = ++clicks;
});
