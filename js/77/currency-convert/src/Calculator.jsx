import { useState, useEffect } from "react";
import Dropdown from './Dropdown.jsx'
import Calc from './Amount.jsx'

export default function Calculator() {
    const [amount, setAmount] = useState(0);
    const [inputAmount, setInputAmount] = useState('');
    const [currencies, setCurrencies] = useState([]);
    const [fromCur, setFromCur] = useState('');
    const [toCur, setToCur] = useState('');
    const [rate, setRate] = useState(0);
    const [symbol, setSymbol] = useState('');
    const [date, setDate] = useState('')

    useEffect(() => {
        (async () => {
            try {
                const response = await fetch('https://api.frankfurter.dev/v2/currencies');
                if (!response.ok) {
                    throw new Error(`${response.status} - ${response.statusText}`);
                }
                const result = await response.json();
                console.log(result);
                setCurrencies(result);
            }
            catch (e) {
                console.error('oops', e);
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            if (fromCur != '' && toCur != '') {
                try {
                    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${fromCur}/${toCur} `);

                    if (!response.ok) {
                        throw new Error(`${response.status} - ${response.statusText}`);
                    }
                    const s = await response.json()
                    setRate(s.rate)
                    setDate(s.date)
                    setSymbol(currencies.find(item => item.iso_code === toCur).symbol)
                }
                catch (e) {
                    console.error('oops', e);
                }
            }
        })();
    }, [fromCur, toCur, currencies])

    return <>
        <h2>From Currency</h2>
        <Dropdown which='1st' onChange={e => { setFromCur(e.target.value) }} value={fromCur} currencies={currencies}></Dropdown>
        <br />
        <br />
        <button onClick={() => { setFromCur(toCur); setToCur(fromCur) }}>switch</button >
        <h2>To Currency</h2>
        <Dropdown which='2nd' onChange={e => { setToCur(e.target.value); console.log({toCur}) }} value={toCur} currencies={currencies}></Dropdown>
        <input type="number" step="any" value={inputAmount} onChange={e => { setInputAmount(Math.abs(Number(e.target.value))); setTimeout(() => { setAmount(e.target.value) }, 1000) }} />
        <Calc from={amount} rate={rate} symbol={symbol} date={date}/>
    </>
}