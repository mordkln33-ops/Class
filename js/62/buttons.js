'use strict'

const theButton = document.querySelector('#theButtonMaker');
const buttonDiv = document.querySelector('#buttons');

const buttonCreator = e => {
    const newButton = document.createElement('button');
    newButton.textContent = parseFloat(e.target.textContent) + 1;
    buttonDiv.appendChild(newButton);
    newButton.addEventListener('click', buttonCreator)
}

theButton.addEventListener('click', buttonCreator)

// Use Bubbling

let count = 0;

const buttonCreator2 = e => {
    if (e.target.matches('button')) {
        const newButton = document.createElement('button');
        newButton.textContent = ++count;
        buttonDiv.appendChild(newButton);
    }
}

buttonDiv.addEventListener('click', buttonCreator2);
