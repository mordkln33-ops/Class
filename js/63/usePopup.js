import showPopup from './popup.js';

const message = document.querySelector('#msg');
const buttons = document.querySelector('#btns');
const functions = document.querySelector('#callBack');
const pop = document.querySelector('#sbmt');

pop.addEventListener('click', e => showPopup(e, message, buttons, functions)); 