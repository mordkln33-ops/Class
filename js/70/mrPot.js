const mrParts = ['images/mr/blue_left_arm.png', 'images/mr/blue_right_arm.png', 'images/mr/black_hat.png', 'images/mr/blue_shoe_1.png', 'images/mr/blue_shoe_2.png', 'images/mr/bowtie.png', 'images/mr/case.png', 'images/mr/hat.png', 'images/mr/left_ear.png', 'images/mr/left_eye.png', 'images/mr/left_eyebrow.png', 'images/mr/left_hand.png', 'images/mr/mouth.png', 'images/mr/mustache.png', 'images/mr/nose.png', 'images/mr/right_ear.png', 'images/mr/right_eye.png', 'images/mr/right_eyebrow.png', 'images/mr/right_hand.png', 'images/mr/tie.png'];

const mrsParts = ['images/mrs/03_flower_glassesmrs.png', 'images/mrs/04_left_eyemrs.png', 'images/mrs/05_right_eyemrs.png', 'images/mrs/06_left_earmrs.png', 'images/mrs/07_right_earmrs.png', 'images/mrs/08_nosemrs.png', 'images/mrs/09_pink_left_glove.png', 'images/mrs/09_smiling_mouthmrs.png', 'images/mrs/10_braided_updo_hairmrs.png', 'images/mrs/10_pink_right_glove.png', 'images/mrs/11_daisy_flower_no_clasp.png', 'images/mrs/11_left_eyebrow.png', 'images/mrs/12_right_eyebrow.png', 'images/mrs/clip.png', 'images/mrs/flower_shoe_1.png', 'images/mrs/flower_Shoe_2.png', 'images/mrs/flowers.png', 'images/mrs/front_only_flower_hat.png', 'images/mrs/left_arm_pink.png', 'images/mrs/pearls.png', 'images/mrs/pocketbook.png', 'images/mrs/right_arm_pink.png', 'images/mrs/tiara.png'];

const parts = document.querySelector('#partSelect');
const mrPartsDiv = document.querySelector('#mrParts');
const mrsPartsDiv = document.querySelector('#mrsParts');
const potato = document.querySelector('#bodyImg');
const mrButton = document.querySelector('#mrPotato');
const mrsButton = document.querySelector('#mrsPotato');

let draggee = null;
let offset = null;

console.log(potato.getClientRects())

mrsParts.forEach(p => {
    const holder = document.createElement('div');
    holder.className = 'singlePart';
    const part = document.createElement('img');
    part.src = p;
    holder.appendChild(part);
    mrsPartsDiv.appendChild(holder);
    console.log(`${p} was added`)
    part.addEventListener('click', addCopy)
})

mrParts.forEach(p => {
    const holder = document.createElement('div');
    holder.className = 'singlePart';
    const part = document.createElement('img');
    part.src = p;
    holder.appendChild(part);
    mrPartsDiv.appendChild(holder);
    console.log(`${p} was added`)
    part.addEventListener('click', addCopy);
})

function addCopy(e) {
    let hideTimer;
    console.log(e.target);
    const partDiv = document.createElement('div');
    partDiv.className = 'partDiv';
    partDiv.style.left = `${e.target.getBoundingClientRect().right}px`;
    partDiv.style.top = `${e.target.getBoundingClientRect().top}px`;
    const newPart = document.createElement('img');
    newPart.className = 'imgPart';
    newPart.src = e.target.src;
    partDiv.appendChild(newPart);
    const buttons = document.createElement('div');
    buttons.className = 'buttonDiv';
    const deleter = document.createElement('img');
    deleter.src = 'images/buttons/delete.png'
    const sizer = document.createElement('img');
    sizer.src = 'images/buttons/expand.png'
    const rotater = document.createElement('img');
    rotater.src = 'images/buttons/rotate.png'

    deleter.addEventListener('click', () => {
        deleter.src = 'images/buttons/delete_clicked.png';
        setTimeout(() => partDiv.remove(), 100);
    })
    sizer.addEventListener('mousedown', () => {
        // e.preventDefault();
        clearTimeout(hideTimer);
        buttons.style.display = 'flex';
        const resize = e => expanderMove(e, partDiv);
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', () => {
            window.removeEventListener('mousemove', resize);
            hideTimer = setTimeout(() => { buttonHider(buttons) }, 3000);
        });
    });
    buttons.appendChild(deleter);
    buttons.appendChild(sizer);
    buttons.appendChild(rotater);
    partDiv.appendChild(buttons);

    newPart.addEventListener('mousedown', () => {
        clearTimeout(hideTimer);
        buttons.style.display = 'flex';
    })
    newPart.addEventListener('mouseup', () => {
        hideTimer = setTimeout(() => { buttonHider(buttons) }, 3000);
    });
    document.body.appendChild(partDiv);
}

mrButton.addEventListener('click', () => {
    mrButton.src = 'images/buttons/mr_clicked.png';
    mrsButton.src = 'images/buttons/mrs.png';
    mrPartsDiv.style.display = 'block';
    mrsPartsDiv.style.display = 'none';
})

mrsButton.addEventListener('click', () => {
    mrButton.src = 'images/buttons/mr.png';
    mrsButton.src = 'images/buttons/mrs_clciked.png';
    mrsPartsDiv.style.display = 'block';
    mrPartsDiv.style.display = 'none';
})

window.addEventListener('mousedown', e => {
    e.preventDefault();
    if (e.target.classList.contains('imgPart')) {
        draggee = e.target.parentElement;
        const rect = e.target.parentElement.getBoundingClientRect();
        console.log('mouse down', e);
        offset = { x: e.clientX - rect.x, y: e.clientY - rect.y };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
});


function handleMouseMove(e) {
    console.log('mouse move', e);
    draggee.style.top = `${e.clientY - offset.y}px`;
    draggee.style.left = `${e.clientX - offset.x}px`;
}

function handleMouseUp() {
    console.log('mouse up');

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
}

function buttonHider(buttons) {
    buttons.style.display = 'none';
}

function expanderMove(e, div) {
    const change = e.movementY;
    const currentHeight = parseFloat(getComputedStyle(div).height);
    div.style.height = `${currentHeight + change}px`;
};