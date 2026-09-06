document.querySelector('#color').addEventListener('change', function() {
  document.body.style.color = this.value;
});

document.querySelector('#bgcolor').addEventListener('input', function() {
  document.body.style.backgroundColor = this.value;
});
