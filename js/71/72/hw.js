const vehicleFunctions = {
  go(speed) {
    this.speed = speed;
    console.log(`${this.color} is now going ${this.speed}`);
  },
  print() {
    console.log(`${this.color} speed is ${this.speed}`);
  }
};

function createVehicle(color) {
  const v = {
    color,
    /*go(speed) {
      this.speed = speed;
      console.log(`${this.color} is now going ${this.speed}`);
    },
    print() {
      console.log(`${this.color} speed is ${this.speed}`);*/
  };

  Object.assign(v, vehicleFunctions);

  return v;
};

const v1 = createVehicle('green');
v1.go(50);
v1.print();
console.log(v1);

const planeFunctions = {
  go(speed) {
    this.speed = speed;
    console.log(`${this.color} is now flying ${this.speed}`);
  }
};

function createPlane(color) {
  const p = createVehicle(color);
  /*p.go = function (speed) {
    this.speed = speed;
    console.log(`${this.color} is now flying ${this.speed}`);
  };*/

  Object.assign(p, planeFunctions);

  return p;
}

const p1 = createPlane('yellow');
p1.go(250);
p1.print();
console.log(p1);

/////////////////////////////

function createVehicle2(color) {
  const v = Object.create(vehicleFunctions);

  v.color = color;

  return v;
}

const v2 = createVehicle2('black');
v2.go(55);
v2.print();
console.log(v2);

const planeProto = Object.create(vehicleFunctions);
planeProto.go = function (speed) {
  this.speed = speed;
  console.log(`${this.color} is now flying ${this.speed}`);
};

function createPlane2(color) {
  const p = Object.create(planeProto);
  p.color = color;

  //Object.assign(p, planeFunctions);

  return p;
}

const p2 = createPlane2('red');
p2.go(1000);
p2.print();
console.log(p2);

///////////////////////////////

/*const VehicleProto = {
  constructor: Vehicle
};
Vehicle.prototype = VehicleProto;*/

function Vehicle(color) {
  this.color = color;
  Vehicle.numberOfVehicles++;
}
// Vehicle.prototype = vehicleFunctions;
Vehicle.prototype.go = function (speed) {
  this.speed = speed;
  console.log(`${this.color} is now going ${this.speed}`);
};
Vehicle.prototype.print = function () {
  console.log(`${this.color} speed is ${this.speed}`);
};
Vehicle.prototype.clone = function () {
  //const clone = new Vehicle(this.color);
  const clone = new this.constructor(this.color);
  clone.speed = this.speed;
  return clone;

  // return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
};

Vehicle.numberOfVehicles = 0;
Vehicle.getNumberOfVehicles = () => Vehicle.numberOfVehicles;

const v3 = new Vehicle('white');
v3.go(65);
v3.print();
console.log(v1, v2, v3);

function Plane(color) {
  Vehicle.call(this, color);
}
Plane.prototype = Object.create(Vehicle.prototype);
Plane.prototype.constructor = Plane;
Plane.prototype.go = function (speed) {
  this.speed = speed;
  console.log(`${this.color} is now flying ${this.speed}`);
};

const p3 = new Plane('purple');
p3.go(1200);
p3.print();
console.log(p3);

v3.go(100);

const clonedV = v3.clone();
clonedV.print();
clonedV.go(110);
console.log(v3, clonedV);

const clonedP = p3.clone();
clonedP.print();
clonedP.go(110);
console.log(p3, clonedP);

////////////////

class VehicleC {
  speed = 0;

  static #numberOfVehicles = 0;
  static getNumberOfVehicles() {
    return VehicleC.#numberOfVehicles;
  }

  constructor(color) {
    this.color = color;
    VehicleC.#numberOfVehicles++;
  }

  go(speed) {
    this.speed = speed;
    console.log(`${this.color} is now going ${this.speed}`);
  }
  print() {
    console.log(`${this.color} speed is ${this.speed}`);
  }
}

const v4 = new VehicleC('brown');
v4.go(75);
v4.print();
console.log(v3, v4);

class PlaneC extends VehicleC {
  constructor(color) {
    super(color);
    this.foo = 5;
  }

  go(speed) {
    this.speed = speed;
    console.log(`${this.color} is now flying ${this.speed}`);
  }

  print() {
    super.print();
    console.log(this.foo);
  }
}

const p4 = new PlaneC('orange');
p4.go(275);
p4.print();
console.log(p3, p4);

//console.log(v3.getNumberOfVehicles() , p3.getNumberOfVehicles(), Vehicle.prototype.getNumberOfVehicles());

console.log(Vehicle.getNumberOfVehicles());
Vehicle.numberOfVehicles = 5000;
console.log(Vehicle.getNumberOfVehicles());

console.log(VehicleC.getNumberOfVehicles());
VehicleC.numberOfVehicles = 5000;
console.log(VehicleC.getNumberOfVehicles());

console.dir(Vehicle);
console.dir(VehicleC);
