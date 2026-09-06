let clicks = 0;
const theButton = document.querySelector('#theButton');

console.log(this);

theButton.addEventListener('click', e => {
  e.stopPropagation();
  
  console.log('button clicked', e);

  clicks++;
  console.log(clicks);

  // document.querySelector('#theButton').textContent = clicks;
  // theButton.textContent = clicks;

  // non arrow this is obj that fired event
  // this.textContent = clicks;
  e.target.textContent = clicks;
});

document.querySelector('#theDiv').addEventListener('click', function (e) {
  console.log('div click', e);

  /*switch(e.target.id) {
    case 'theButton':
      console.log('call order(theButton)');
      break;
    case 'another':
      console.log('do another thing');
      break;
    default:
      console.log('unknown operation');
  }*/

  console.log(`call order(${e.target.id})`);
});
