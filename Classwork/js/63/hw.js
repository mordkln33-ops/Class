let buttons = 1;

const container = document.querySelector('#container');

function clickHandler(e) {
  // console.log('one clicked');
  //document.body.innerHTML += '<button>2</button>';

  const newButton = document.createElement('button');
  newButton.innerText = ++buttons;
  /*document.body*/container.appendChild(newButton);

  //newButton.addEventListener('click', clickHandler);
  e.stopPropagation();
}

document.querySelector('#one').addEventListener('click', clickHandler);



container.addEventListener('click', e => {
  console.log(e.target);
  if(!e.target.matches('button')) {
    console.log('ignoring ', e.target.nodeName);
    return;
  }

  const newButton = document.createElement('button');
  newButton.innerText = ++buttons;
  container.appendChild(newButton);
});
