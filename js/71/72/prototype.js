const organism = {
  exists: true
};
const animal = Object.create(organism);
const mammal = Object.create(animal);
mammal.hasHair = true;
const dog = Object.create(mammal);
dog.speak = () => console.log('woof!');

console.log(organism, animal, mammal, dog);
dog.speak();

const spot = Object.create(dog);
spot.name = 'Spot';
spot.weight = 100;
spot.color = 'black';
spot.breed = 'pitbull';

console.log(spot);
spot.speak();
console.log(spot.hasHair, spot.exists);

const fido = Object.create(spot);
fido.name = 'Fido';
console.log(fido);
fido.speak();
console.log(fido.hasHair, fido.exists);
