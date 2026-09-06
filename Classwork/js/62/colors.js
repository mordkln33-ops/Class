const colorInput = document.querySelector('#color');
const bgcolorInput = document.querySelector('#bgcolor');

document.querySelector('#theForm').addEventListener('submit', e => {
  e.preventDefault();

  console.log('clicked');

  document.body.style.color = colorInput.value;
  document.body.style.backgroundColor = bgcolorInput.value;
});
