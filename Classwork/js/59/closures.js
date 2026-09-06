function greet(name) {
  console.log(`Hello ${name}`);
}

greet('Donald');

///////////

const greeter = function (name) {
  console.log(`Hello ${name}`);
}

greeter('JD');

//////////////

function getGreeter() {
  return function (name) {
    console.log(`Hello ${name}`);
  };
}

const theGreeter = getGreeter();
theGreeter('Marco');

////////////////

function getBetterGreeter(name) {
  return function () {
    console.log(`Hello ${name}`);
  };
}

const theBetterGreeter = getBetterGreeter('Pete');
theBetterGreeter();


const netnyahuGreeter = getBetterGreeter('Bibi');
const aocGreeter = getBetterGreeter('AOC');
// used some time later
netnyahuGreeter();
aocGreeter();

////////

function foo(y) {
  const x = y + 1;
  const result = bar(x);
  console.log(result);
}

function bar(z) {
  const q = z + 3;
  return q;
}

foo(5);

/*
foo - {y = 5, x = 6, result = 9}
bar - {z = 6, q = 9}
*/
