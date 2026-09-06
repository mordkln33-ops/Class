'use strict';

/*const potus = {
  first: 'Donald',
  last: 'Trump',
  print() {
    console.log(`first: ${this.first} last: ${this.last}`);
  }
};

potus.print();*/

function printPerson(person) {
  console.log(`first: ${person.first} last: ${person.last}`);
}

function printThePerson(date, time) {
  console.log(this);

  console.log(`${date} - ${time} - first: ${this.first} last: ${this.last}`);
}

function createPerson(first, last) {
  return {
    first,
    last,
    /*print() {
      console.log(`first: ${this.first} last: ${this.last}`);
    }*/
   print: printThePerson
  };
}

const potus = createPerson('Donald', 'Trump');
const vpotus = createPerson('J', 'D');

potus.print('8/23/26', '8:30pm');
vpotus.print('8/23/26', '8:30pm');

printPerson(potus);
printPerson(vpotus);

//printThePerson();

const potusesPrint = potus.print;
//potusesPrint();

const params = ['8/23/26', '8:30pm'];
printThePerson.call(potus, params[0], params[1]);
printThePerson.apply(vpotus, params);
printThePerson.call(vpotus, ...params);

potusesPrint.call(potus, ...params);
potusesPrint.call(vpotus, ...params);

const printPotus = printThePerson.bind(potus, ...params);
// 1000 lines later
printPotus();

const printVpotusOn823 = printThePerson.bind(vpotus, '8/23/26');
printVpotusOn823('8:39pm');

const printVpotusOn823At840 = printThePerson.bind(vpotus, '8/23/26', '8:40pm');
printVpotusOn823At840();


//////////////////////////

const helloGreeting = {
  greeting: 'Hello'
};

const shalomGreeting = {
  greeting: 'Shalom'
};

function greet(name) {
  console.log(`${this.greeting} ${name}`);
}

greet.call(helloGreeting, 'Donald');
greet.call(shalomGreeting, 'Donald');

const sayHello = greet.bind(helloGreeting);
sayHello('JD');
sayHello('Marco');

const sayShalom = greet.bind(shalomGreeting);
sayShalom('Jared');

const sayShalomToIvanka = greet.bind(shalomGreeting, 'Ivanka');

sayShalomToIvanka();
