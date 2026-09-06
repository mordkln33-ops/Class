const contactsTable = document.querySelector('#contactsTable tbody');
const addContactForm = document.querySelector('#addContact');
const firstInput = document.querySelector('#first');
const lastInput = document.querySelector('#last');
const emailInput = document.querySelector('#email');
const phoneInput = document.querySelector('#phone');

const contacts = [];

document.querySelector('#addContact').addEventListener('submit', e => {
  e.preventDefault();

  if (!contacts.length) {
    contactsTable.innerHTML = '';
    //contactsTable.children[0].remove();
    //contactsTable.deleteRow(0);
  }

  const newContact = {
    first: firstInput.value,
    last: lastInput.value,
    email: emailInput.value,
    phone: phoneInput.value
  };

  contacts.push(newContact);

  /* create elements
  const row = document.createElement('tr');
  const firstCell = document.createElement('td');
  firstCell.textContent = 'Donald';
  row.appendChild(firstCell);
  contactsTable.appendChild(row);*/

  const row = contactsTable.insertRow();
  //const firstCell = row.insertCell();
  //firstCell.textContent = 'Donald';

  row.innerHTML = `
    <td>${firstInput.value}</td>
    <td>${lastInput.value}</td>
    <td>${emailInput.value}</td>
    <td>${phoneInput.value}</td>
  `;

  addContactForm.style.display = 'none';
  /*firstInput.value = '';
  lastInput.value = '';
  emailInput.value = '';
  phoneInput.value = '';*/

  addContactForm.reset();
});

document.querySelector('#add').addEventListener('click', () => {
  addContactForm.style.display = 'block';
});
