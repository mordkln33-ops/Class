// import { useState } from 'react'
import Address from './Address'
import Address2 from './Address'
import Address3 from './Address'
import './App.css'

const p1 = {
  name: 'Joe',
  number: '546',
  city: 'Somewhere',
  state: 'Sometown',
  zip: '12322'
}

const p2 = {
  name: 'Jake',
  number: '789',
  city: 'Nowhere',
  state: 'Notown',
  zip: '09888'
}

function App() {
  return (
    <>
      <Address name="John" number="123" street="Anywhere" city="Anytown" state="IL" zip="12345" />
      <br />
      <div>{Address2(p1)}</div>
      <br />
      <Address3 {...p2} />
    </>

  )
}

export default App
