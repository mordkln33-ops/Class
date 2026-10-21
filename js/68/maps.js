const { Map } = await google.maps.importLibrary('maps');

    // Create a new map from the div with id="map".
    const map = new Map(document.querySelector('#map'), {
        center: { lat: -34.397, lng: 150.644 },
        zoom: 8,
        renderingType: 'VECTOR',
    });