// // Constructors

// function Vehicle(color) {
//     this.color = color;
// }

// Vehicle.prototype.go = function (speed) {
//     this.speed = speed;
//     console.log(`The car is driving at ${this.speed} miles per hour`);
// }

// Vehicle.prototype.print = function () {
//     console.log(`The vehicle is ${this.color}, The vehicle's speed is ${this.speed}.`);
// }
// function Airplane(color) {
//     this.color = color;
// }

// Airplane.prototype = Object.create(Vehicle.prototype);

// Airplane.prototype.constructor = Airplane;
// Airplane.prototype.go = function (speed) {
//     this.speed = speed;
//     console.log(`The airplane is flying at ${this.speed} miles per hour.`);
// }

// const car = new Vehicle('red');
// car.print();
// car.go(50);
// car.print();

// const plane = new Airplane('blue');
// plane.print();
// plane.go(540);
// plane.print();

// console.log(car);
// console.log(plane);

const vehicleFunctions = {
    print() {
        console.log(`color is ${this.color}, going at ${this.speed}.`)
    },
    go(speed) {
        this.speed = speed;
        console.log(`now going at ${this.speed}.`)
    }
}

function createVehicle(color) {
    const vehicle = {
        color: color,
    }
    Object.assign(vehicle, vehicleFunctions);
    return vehicle;
}

function createAirplane(color) {
    const plane = createVehicle(color);

    plane.go = function (speed) {
        this.speed = speed;
        console.log(`now flying at ${this.speed}.`)
    }
    return plane;
}

const car2 = createVehicle('red');
car2.print();
car2.go(50);
car2.print();

const plane2 = createAirplane('blue');
plane2.print();
plane2.go(540);
plane2.print();

console.log(car2);
console.log(plane2);