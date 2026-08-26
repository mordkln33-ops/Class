function bankAccount(balance) {
    return {
        balance,
        performTransaction: function (amount) {
            this.balance += amount;
        },
        showBalance: function () {
            console.log(`The balance is ${this.balance}`)
        }
    }
}

const acnt1 = bankAccount(7430);
const acnt2 = bankAccount(33);

acnt1.performTransaction(765);
acnt1.showBalance();
acnt2.performTransaction(-1576);
acnt2.showBalance();

function performTransaction(amount) {
    this.balance += amount;
}

performTransaction.call(acnt1, -7689);
acnt1.showBalance();
performTransaction.call(acnt2, 7689);
acnt2.showBalance();

const depositFiftyacnt1 = performTransaction.bind(acnt1, 50);
const withdrawFiftyacnt2 = performTransaction.bind(acnt1, 50);
depositFiftyacnt1();
withdrawFiftyacnt2();
acnt1.showBalance();
acnt2.showBalance();