import { useEffect, useState } from "react"

export default function Dropdown({ which, onChange, value }) {
    const [currencies, setCurrencies] = useState([]);
    // const [currency, setCurrency] = useState('');

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

    return (
        <>
            <select id={which} onChange={onChange} value={value}>
                <option hidden>---</option>
                {currencies?.map((r) => <option key={r.iso_code} value={r.iso_code}>{r.iso_code} - {r.name}</option>)}
            </select>
        </>
    )
}

// value={currency} onChange={e => setCurrency(e.target.value)}