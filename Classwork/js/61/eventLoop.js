// const theButton = document.getElementById('theButton');
const theButton = document.querySelector('#theButton');

/*
theButton.style.backgroundColor = 'red';
theButton.style.padding = '1em';
theButton.style.fontWeight = 'bold';
theButton.style.fontSize = '2em';

theButton.style.position = 'absolute';
theButton.style.top = 0;
*/

//theButton.className = 'button foo';

theButton.classList.add('button');
theButton.classList.add('foo');
theButton.classList.remove('bar');

/*for (let i = 0; i < 200; i++) {
  //theButton.style.top = theButton.style.top + 1;

  const currentTop = getComputedStyle(theButton).top;

  console.log(parseInt(currentTop));

  theButton.style.top = `${parseInt(currentTop) + 1}px`;
}*/

function moveIt() {
  theButton.style.top = `${parseInt(getComputedStyle(theButton).top) + 1}px`;

  // setTimeout(moveIt, 100);
}

// moveIt();

// setTimeout(moveIt, 100);
// setInterval(moveIt, 100);

//let running = false;
let interval;
const controlButton = document.querySelector('#control');

/*document.querySelector('#control')*/controlButton.addEventListener('click', e => {
  console.log(e);

  //if (! running) {
  if (!interval) {
    interval = setInterval(moveIt, 100);
    // console.log(theInterval);
    // running = true;
    /*document.querySelector('#control')*//*controlButton.*/ /*this*/e.target.textContent = 'stop';
  } else {
    clearInterval(interval);
    //running = false;
    interval = null;
    /*controlButton*//*this*/e.target.textContent = 'start';
  }

  /*setTimeout(() => {
    clearInterval(theInterval);
  }, 10000);*/
});

document.querySelectorAll('button').forEach(b => {
  console.log(b);
  b.style.fontFamily = 'cursive';
});

