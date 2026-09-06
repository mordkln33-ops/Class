const height = 170;
const width = 240;
let topOffset = -height / 2;
let leftOffset = -width / 2;

let nextZindex = 1;

const modalDiv = document.createElement('div');
modalDiv.style.position = 'absolute';
modalDiv.style.top = 0;
modalDiv.style.left = 0;
modalDiv.style.width = '100%';
modalDiv.style.height = '100%';
modalDiv.style.backgroundColor = 'lightgray';
modalDiv.style.opacity = .5;
modalDiv.style.display = 'none';
document.body.appendChild(modalDiv);

export default function (/*msg, buttons*/ /*= ['ok'], modal = false, callback*/ options) {
  options.buttons = options.buttons ?? ['ok'];

  const div = document.createElement('div');

  const msgDiv = document.createElement('div');
  msgDiv.innerText = options.msg;
  msgDiv.style.overflow = 'auto';
  msgDiv.style.height = '6.5em';
  div.appendChild(msgDiv);

  div.style.backgroundColor = 'lightcyan';
  div.style.border = '1px solid black';
  div.style.padding = '1em';
  div.style.boxSizing = 'border-box';
  div.style.height = `${height}px`; // '8.5em';
  div.style.width = `${width}px`; //'15em';

  div.style.position = 'absolute';
  div.style.top = '50%';
  div.style.left = '50%';
  div.style.marginTop = `${topOffset}px`; // '-4.25em';
  div.style.marginLeft = `${leftOffset}px`; // '-7.5em';

  const buttonDiv = document.createElement('div');
  buttonDiv.style.position = 'absolute';
  buttonDiv.style.width = '100%';
  buttonDiv.style.bottom = '1em';
  buttonDiv.style.textAlign = 'center';
  buttonDiv.style.left = '0';

  options.buttons.forEach(buttonText => {
    const button = document.createElement('button');
    button.innerText = buttonText;
    button.addEventListener('click', () => {
      div.remove();
      modalDiv.style.display = 'none';
      //if (options.callback) {
      //options.callback && options.callback(buttonText);
      options.callback?.(buttonText);
      //}
    });
    buttonDiv.appendChild(button);
  });

  div.appendChild(buttonDiv);
  document.body.appendChild(div);

  if (options.modal) {
    modalDiv.style.zIndex = nextZindex++;
    div.style.zIndex = nextZindex++;
    modalDiv.style.display = 'block';

    div.style.marginTop = `${-height / 2}px`; // '-4.25em';
    div.style.marginLeft = `${-width / 2}px`; // '-7.5em';
  } else {
    topOffset += 10;
    leftOffset += 10;
  }

  if (topOffset + height + (window.innerHeight / 2) > window.innerHeight) {
    topOffset -= window.innerHeight - height;
  }

  if (leftOffset + width + (window.innerWidth / 2) > window.innerWidth) {
    leftOffset -= window.innerWidth - width;
  }

  div.addEventListener('click', () => {
    div.style.zIndex = nextZindex++;
  });
}
