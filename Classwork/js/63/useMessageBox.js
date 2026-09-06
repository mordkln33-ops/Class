import showMessage from "./messageBox.js";

showMessage('it works!');


const msgInput = document.querySelector('#msg');

document.querySelector('#showMessage').addEventListener('submit', (e) => {
  e.preventDefault();
  showMessage(msgInput.value);
});
