
export default (e, message = '', buttons = '', functions = '') => {
    e.preventDefault();

    const buttonArr = buttons.value.split(',').filter(button => button !== '');
    let funcArr = functions.value.split(',');

    const thePopUp = document.createElement('div');
    thePopUp.classList.add('popup');

    const msgDiv = document.createElement('div');
    msgDiv.innerText = message.value;
    msgDiv.style.overflow = 'auto';
    msgDiv.style.height = '6.5em';
    thePopUp.appendChild(msgDiv);

    const buttonDiv = document.createElement('div');
    buttonDiv.style.display = 'flex';
    buttonDiv.style.flexDirection = 'row';
    buttonDiv.style.alignItems = 'center';
    buttonDiv.style.justifyContent = 'space-around';
    buttonDiv.style.width = '100%';
    thePopUp.appendChild(buttonDiv);

    if (!buttonArr.length) {
        const defaultButton = document.createElement('button');
        defaultButton.innerText = 'OK';
        defaultButton.addEventListener('click', () => {
            thePopUp.remove();
        })
        buttonDiv.appendChild(defaultButton);
    } else {
        for (let i = 0; i < buttonArr.length; i++) {
            const button = document.createElement('button');
            button.innerText = buttonArr[i];
            if (funcArr[i]) {
                button.addEventListener('click', () => { eval(funcArr[i]); });
            }
            else {
                button.addEventListener('click', () => {
                    thePopUp.remove();
                })
            }
            buttonDiv.appendChild(button);
        }
    }
    document.body.appendChild(thePopUp);
};

