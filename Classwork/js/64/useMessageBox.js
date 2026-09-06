import showMessage from "./messageBox.js";

showMessage({
  msg: 'it works!',
  buttons: ['yes', 'no', 'maybe'],
  callback: whatTheUserChose => /*alert*/console.log(`you clicked ${whatTheUserChose}`)
});

const msgInput = document.querySelector('#msg');
const modalInput = document.querySelector('#modal');

document.querySelector('#showMessage').addEventListener('submit', (e) => {
  e.preventDefault();
  showMessage({ msg: msgInput.value, modal: modalInput.checked });
});
