let acceptedConditions = false;

document.querySelector('#terms').addEventListener('click', function(e) {
  acceptedConditions = true;
  this.disabled = true;
});

document.querySelector('#theAnchor').addEventListener('click', function (e) {
  console.log('anchor clicked');

  if (!acceptedConditions) {
    e.preventDefault();
  }
});
