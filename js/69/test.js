dropDwn.addEventListener('change', e => {

    const load = saveData.find(obj => obj[0].title === e.target.value);
    sideList.innerHTML = '';
    clearMarkers();
    currentArr.length = 0;
    for (let i = 1; i < load.length; i++) {
        const cardObj = {
            card: createCard(load[i]),
            marker: addMarker(load[i])
        }
        cards.push(cardObj);
        currentArr.push(load[i]);
    }
})


