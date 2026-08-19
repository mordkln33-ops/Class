'use strict'

const theButton = document.querySelector('#theButton');
const theSpan = document.querySelector('#theSpan');
let clicks = 0;
function handleButtonClick() {
    theSpan.textContent = ++clicks;
}

theButton.addEventListener('click', handleButtonClick);