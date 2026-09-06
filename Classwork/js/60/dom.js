'use strict';

// IIFE
(function /*setUpTheClicks*/() {

  const theButton = document.querySelector('#theButton');
  const theSpan = document.querySelector('#theSpan');

  let clicks = 0;

  theButton.addEventListener('click', e => {
    console.log(e);
    theSpan.textContent = ++clicks;

    console.log('got a click!', clicks);
  });
  
})();

//setUpTheClicks();
