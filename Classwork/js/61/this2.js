const potus = {
  first: 'Donald',
  last: 'Trump',
  age: 80,
  print1() {
    console.log(`first: ${this.first} last: ${this.last} age: ${this.age}`);
  },
  live() {
    console.log('->', this);
    /*const that = this;

    setInterval(function () {
      console.log(/*this* /that);
      /*this* /that.age++;
      /*this* /that.print1();
    }, 1000);*/

    /*function liveCallback() {
      console.log(this);
      this.age++;
      this.print1();
    }
    liveCallback.bind(this);
    setInterval(liveCallback, 1000);*/

    setInterval(() => {
      console.log(this);
      this.age++;
      this.print1();
    }, 1000);
  }
};

potus.print1();
potus.live();
