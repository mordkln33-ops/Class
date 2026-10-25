const { Map, MapElement, InfoWindow } = await google.maps.importLibrary('maps');
const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
const { LatLng } = await google.maps.importLibrary('core');
const sideBar = document.querySelector('#sideBar');
const search = document.querySelector('#search');
const submitButton = document.querySelector('#submitButton')
const sideCards = document.querySelectorAll('#sideBar');
const sideList = document.querySelector('#sideList');
const dropDwn = document.querySelector('#savedLocations');
const clearButton = document.querySelector('#clearButton')
let center;
const info = new InfoWindow;
const markers = [];
const cards = [];
const saveData = JSON.parse(
    localStorage.getItem('savedCards') || '[]');
const currentArr = [];

clearButton.addEventListener('click', () => {
    saveData.length = 0;
    dropDwn.innerHTML = '<option hidden>Select a Location</option>';
    localStorage.removeItem('savedCards');
})

const listAdd = (objArr) => {
    const listItem = document.createElement('option');
    listItem.textContent = objArr[0].title;
    listItem.value = objArr[0].title;
    dropDwn.appendChild(listItem);
}

const saver = (objArr) => {
    if (!saveData.some(obj => obj[0].title === objArr[0].title)) {
        const copy = structuredClone(objArr);
        saveData.push(copy);
        listAdd(objArr);
        localStorage.setItem('savedCards', JSON.stringify(saveData));
    }
}

if (saveData.length > 0) {
    saveData.forEach(d => {
        listAdd(d);
    })
}

dropDwn.addEventListener('change', e => {

    const load = saveData.find(obj => obj[0].title === e.target.value);
    sideList.innerHTML = '';
    clearMarkers();
    currentArr.length = 0;
    sideBar.style.display = 'inline-block';
    for (let i = 1; i < load.length; i++) {
        const cardObj = {
            card: createCard(load[i]),
            marker: addMarker(load[i])
        }
        cards.push(cardObj);
        currentArr.push(load[i]);
    }
})

const createMapObj = (lat, lng, title, text, image) => {
    const mapObj = {
        lat: lat,
        lng: lng,
        title: title,
        text: text,
        image: image
    }
    return mapObj;
}

const addMarker = function (obj) {
    const thisPosition = new LatLng(obj.lat, obj.lng)
    const marker = new AdvancedMarkerElement({
        map,
        position: thisPosition,
        title: obj.title
    });
    if (obj.image) {
        const img = document.createElement('img');

        img.src = obj.image;
        img.alt = obj.title;
        img.className = 'markerImage'

        marker.append(img);
    }
    const content = document.createElement('div');
    const heading = document.createElement('h3');
    const description = document.createElement('p');
    const img = document.createElement('img');
    img.src = obj.image;

    heading.textContent = obj.title;
    description.textContent = obj.text;

    content.append(img, heading, description);

    marker.addEventListener('mouseenter', () => {
        info.setContent(content);
        info.open({
            map,
            anchor: marker,
        });
        marker.addEventListener('mouseleave', () => { info.close() });
    });
    markers.push(marker);
    return marker;
}

const clearMarkers = () => {
    markers.forEach(m => {
        m.map = null;
    })
    markers.length = 0;
    cards.length = 0;
}

const createCard = (obj) => {
    const li = document.createElement('li');
    const card = document.createElement('div');
    card.className = 'sideCard';
    const img = document.createElement('img');
    img.src = obj.image;
    card.appendChild(img);
    const textDiv = document.createElement('div');
    const cardTitle = document.createElement('h3');
    const cardText = document.createElement('p');
    cardTitle.textContent = obj.title;
    cardText.textContent = obj.text;
    textDiv.appendChild(cardTitle);
    textDiv.appendChild(cardText);
    card.appendChild(textDiv);
    li.appendChild(card);
    sideList.appendChild(li);
    return card;
}

const map = new Map(document.querySelector('#map'), {
    center: { lat: 40.752, lng: -73.996 },
    zoom: 10,
    renderingType: 'VECTOR',
    mapId: 'DEMO_MAP_ID'
});
console.log(map.center.lat(), map.center.lng());

map.addListener('idle', () => {
    center = map.getCenter()
    console.log(center.lat(), center.lng())
});

submitButton.addEventListener('click', async () => {
    sideList.innerHTML = '';
    clearMarkers();
    currentArr.length = 0;
    const query = search.value.trim();
    const results = await fetch(`http://api.geonames.org/wikipediaSearchJSON?q=${encodeURIComponent(query)}&maxRows=10&username=mordkln`);
    const { geonames } = await results.json();
    const newCenter = new LatLng(geonames[0].lat, geonames[0].lng);
    map.panTo(newCenter);
    const imageArr = await Promise.all(geonames.map(async d => {
        const imgsrc = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&titles=${d.title}&prop=pageimages&format=json&pithumbsize=100&origin=*`
        )
        const thumb = await imgsrc.json();
        const pages = Object.values(thumb.query.pages);
        const image = pages[0]?.thumbnail?.source;

        return image;
    }))

    console.log(imageArr);
    console.log(geonames);
    sideBar.style.display = 'inline-block';
    const title = { title: query }
    currentArr.push(title);
    for (let i = 0; i < geonames.length; i++) {

        const info = createMapObj(Number(geonames[i].lat), Number(geonames[i].lng), geonames[i].title, geonames[i].summary, imageArr[i])

        const cardObj = {
            card: createCard(info),
            marker: addMarker(info)
        }
        cards.push(cardObj);
        currentArr.push(info);
    }
    saver(currentArr);
})
sideBar.addEventListener('click', e => {
    const card = e.target.closest('.sideCard');
    const index = cards.findIndex(c => c.card === card);
    map.panTo(cards[index].marker.position);
})



// const clearMarkers = () => {
//     markers.forEach(m => {
//         m.map = null;
//     })
//     markers.length = 0;
// }