// import $ from "./pcsTools.js";

/*const potus = pcsTools.getElement('#potus');
pcsTools.css(potus, 'color', 'orange');
pcsTools.click(potus, () => console.log('potus was clicked'));
pcsTools.on(potus, 'mouseenter', () => pcsTools.css(potus, 'backgroundColor', 'blue'));
pcsTools.on(potus, 'mouseleave', () => pcsTools.css(potus, 'backgroundColor', 'white'));

//pcsTools.css(potus, 'fontFamily', 'cursive');
console.log(pcsTools.css(potus, 'fontFamily'));

pcsTools.css(potus, 'position', 'absolute');
pcsTools.css(potus, 'bottom', 0);*/

const potus = $('#potus');
potus.css('color', 'orange');
potus.click(() => console.log('potus was clicked'));
potus.on('mouseenter', () => potus.css('backgroundColor', 'blue'));
potus.on('mouseleave', () => potus.css('backgroundColor', 'white'));

//potus.css('fontFamily', 'cursive');
console.log(potus.css('fontFamily'));

potus.css('position', 'absolute');
potus.css('bottom', 0);


$('h1').css('fontSize', '3em');
