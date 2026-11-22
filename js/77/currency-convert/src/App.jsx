import Drop from './Dropdown.jsx'
import Amount from './Amount.jsx'
import Header from './Header.jsx'
import './App.css'
import { useState } from 'react'

export default function App() {
  const [fromCur, setFromCur] = useState('');
  const [toCur, setToCur] = useState('');
  return (
    <>
      <Header></Header>
      <h2>From Currency</h2>
      <Drop which='1st' onChange={e => { setFromCur(e.target.value) }} value={fromCur}></Drop>
      <br />
      <br />
      <button onClick={() => { setFromCur(toCur); setToCur(fromCur) }}>switch</button >
      <h2>To Currency</h2>
      <Drop which='2nd' onChange={e => { setToCur(e.target.value) }} value={toCur}></Drop>
      <Amount fro={fromCur} t={toCur} ></Amount>
    </>
  )
}


