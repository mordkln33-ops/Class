'use strict';

const potus = {
  first: 'Donald',
  last: 'Trump',
  age: 87,
  // print: function () {
  print() {
    console.log(`first: ${this.first} last: ${this.last} age: ${this.age}`);
  }
};

console.log(potus);
console.log(potus.first);
potus.print();

function printPerson(person) {
  console.log(`first: ${person.first} last: ${person.last} age: ${person.age}`);
}

function print() {
  console.log(`first: ${this.first} last: ${this.last} age: ${this.age}`);
}

function createPerson(first, last, age) {
  return {
    first,// : first,
    last,
    age,
    // print: function () {
    /*print() {
      console.log(`first: ${this.first} last: ${this.last} age: ${this.age}`);
    }*/

    print//: printPerson2

    // print: function () { printPerson(this); }

  };
}

const jd = createPerson('J', 'D', 50);
console.log(jd);
jd.print();

const marco = createPerson('Marco', 'Rubio', 51);
console.log(marco);
marco.print();

printPerson(jd);
printPerson(marco);

console.dir(print);
print.foo = 5;
console.dir(print);

console.log(jd, marco);

const flotus = {
  first: 'Melania',
  last: 'Trump',
  age: 55
};

flotus.age = 56;
//flotus = {};

console.log(flotus);

//const i = 5;
//i = 6;

const numbers = [1,2,3];
//numbers = [4,5,6];
numbers[0] = 5;
numbers.push(4);
console.log(numbers);

flotus.email = 'flotus@whitehouse.gov';
console.log(flotus);

//////////////////////
/*
{
  "first": "Donald",
  "last": "Trump",
  "age": 87
}
*/

const potusJSON = JSON.stringify(potus);
console.log(potusJSON);

const reconstitutedPotus = JSON.parse(potusJSON);
console.log(reconstitutedPotus);

const reconstitutedPotusWithPrint = createPerson(reconstitutedPotus.first, reconstitutedPotus.last, reconstitutedPotus.age);
reconstitutedPotusWithPrint.print();

function createPersonFromJSON(p) {
  const person = JSON.parse(p);

  return {
    first: person.first,
    last: person.last,
    age: person.age,
    print
  };
}

const reconstituedPotusB = createPersonFromJSON(potusJSON);

reconstituedPotusB.print();

///////////////////////

function createPerson2(first, last) {
  return {
    _first: first,
    last,
    getFirst() {
      return this._first;
    },
    setFirst(first) {
      if (first === 'Yoel') {
        throw new Error('Yoel is not allowed');
      }

      this._first = first;
    },
    print() {
      console.log(`first: ${this._first} last: ${this.last}`);
    }
  };
}

const p = createPerson2('Jared', 'Kushner');
//p.first = 'Yoel';
//p._first = 'Yoel';
p.setFirst('Joel');
p.print();

console.log(p);


function createPerson3(first, l) {
  // let first = f;

  return {
    //_first: first,
    last: l,
    getFirst() {
      //return this._first;
      return first;
    },
    setFirst(f) {
      if (f === 'Yoel') {
        throw new Error('Yoel is not allowed');
      }

      //this._first = first;
      first = f;

      return this;
    },
    print() {
      console.log(`first: ${first} last: ${this.last}`);

      return this;
    }
  };
}

const todd = createPerson3('Todd', 'Blanche');
todd.first = 'foo';
todd._first = 'bar';
todd.print();

// chaining
console.log(todd.setFirst('Joe')
    .print()
    .setFirst('Todd')
    .print()
    .getFirst());
