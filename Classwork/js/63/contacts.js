const contactsTable = document.querySelector('#contactsTable tbody');
const addContactForm = document.querySelector('#addContact');
const firstInput = document.querySelector('#first');
const lastInput = document.querySelector('#last');
const emailInput = document.querySelector('#email');
const phoneInput = document.querySelector('#phone');
const addContactButton = document.querySelector('#add');
let contacts = [];

function hideAddContactForm() {
  addContactForm.style.display = 'none';
  addContactForm.reset();
  addContactButton.style.visibility = 'visible';
}

addContactForm.addEventListener('submit', e => {
  e.preventDefault();

  if (!contacts.length) {
    contactsTable.innerHTML = '';
  }

  const newContact = {
    first: firstInput.value,
    last: lastInput.value,
    email: emailInput.value,
    phone: phoneInput.value
  };

  contacts.push(newContact);

  const row = contactsTable.insertRow();

  // <td><button>delete</button></td>
  row.innerHTML = `
    <td>${firstInput.value}</td>
    <td>${lastInput.value}</td>
    <td>${emailInput.value}</td>
    <td>${phoneInput.value}</td>
    <td><button>delete</button></td>
  `;

  /*const td = document.createElement('td');
  const deleteButton = document.createElement('button');
  deleteButton.innerText = 'delete';
  td.appendChild(deleteButton);
  row.appendChild(td);
  deleteButton.addEventListener('click', () => {
    console.log('delete row here');
  });*/

  row.querySelector('button').addEventListener('click', () => {
    row.remove();

    contacts = contacts.filter(c => c !== newContact);

    if (!contacts.length) {
      contactsTable.innerHTML = `<tr>
          <td colspan="5">no contacts loaded</td>
        </tr>`;
    }
  });

  hideAddContactForm();
});

addContactButton.addEventListener('click', () => {
  addContactForm.style.display = 'block';
  addContactButton.style.visibility = 'hidden';
});

document.querySelector('#cancel').addEventListener('click', hideAddContactForm);
