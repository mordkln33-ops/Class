function performTransaction(amount, category) {
  console.log(category, amount);
  this.balance += amount;
}

function createAccount(openingBalance) {
  return {
    balance: openingBalance/*,
    performTransaction(amount) {
      this.balance += amount;
    }*/
  };
}

/*function createAccount(openingBalance) {
  let balance = openingBalance;
  return {
    getBalance: () => balance,
    performTransaction: amount => balance += amount
  };
}*/

const account1 = createAccount(1000);
const account2 = createAccount(2000);
console.log(account1, account2);
/*account1.performTransaction(-50);
account2.performTransaction(50);
console.log(account1, account2);

performTransaction(50);*/

performTransaction.call(account1, -50, 'food');
performTransaction.apply(account2, [50, 'clothing']);

const transactOnAccount1 = performTransaction.bind(account1);
transactOnAccount1(-50, 'rent');

const addFiftyToAccount2 = performTransaction.bind(account2, 50);
addFiftyToAccount2('paycheck');

const spendFiftyOnSnacksFromAccount1 = performTransaction.bind(account1, -50, 'snacks');

spendFiftyOnSnacksFromAccount1();
spendFiftyOnSnacksFromAccount1();
spendFiftyOnSnacksFromAccount1();

console.log(account1, account2);
