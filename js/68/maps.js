const { Map, MapElement, InfoWindow } = await google.maps.importLibrary('maps');
const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
const { LatLng } = await google.maps.importLibrary('core');
const sideBar = document.querySelector('#sideBar');
const search = document.querySelector('#search');
const submitButton = document.querySelector('#submitButton')
let center;
const info = new InfoWindow;
const markers = [];

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
    sideBar.innerHTML = '';
    clearMarkers();
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
    for (let i = 0; i < 10; i++) {
        createCard(imageArr[i], geonames[i].title, geonames[i].summary);
        addMarker(Number(geonames[i].lat), Number(geonames[i].lng), geonames[i].title, geonames[i].summary, imageArr[i]);
    }
})

const addMarker = function (lat, lng, whatsit, text, image) {
    const thisPosition = new LatLng(lat, lng)
    const marker = new AdvancedMarkerElement({
        map,
        position: thisPosition,
        title: whatsit
    });
    // // if (image) {
    // //     const img = document.createElement('img');

    // //     img.src = image;
    // //     img.alt = whatsit;
    // //     img.style.width = '60px';
    // //     img.style.height = '60px';
    // //     img.style.objectFit = 'cover';

    // //     marker.append(img);
    // }
    const content = document.createElement('div');
    const heading = document.createElement('h3');
    const description = document.createElement('p');
    const img = document.createElement('img');
    img.src = image;

    heading.textContent = whatsit;
    description.textContent = text;

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
}
const createCard = (image, title, text) => {
    const card = document.createElement('div');
    card.className = 'sideCard';
    const img = document.createElement('img');
    img.src = image;
    card.appendChild(img);
    const textDiv = document.createElement('div');
    const cardTitle = document.createElement('h3');
    const cardText = document.createElement('p');
    cardTitle.textContent = title;
    cardText.textContent = text;
    textDiv.appendChild(cardTitle);
    textDiv.appendChild(cardText);
    card.appendChild(textDiv);
    sideBar.appendChild(card);
}

const clearMarkers = () => {
    markers.forEach(m => {
        m.map = null;
    })
    markers.length = 0;
}