import { useEffect, useState } from "react"


export default function Calc({ fro, t }) {

    const [from, setFrom] = useState(0);
    const [to, setTo] = useState();
    const [fromf, setFromf] = useState(0);

    useEffect(() => {
        (async () => {
            if (fro != '' && t != '') {
                try {
                    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${fro}/${t} `);

                    if (!response.ok) {
                        throw new Error(`${response.status} - ${response.statusText}`);
                    }
                    const s = await response.json();
                    const number = (Number(fromf) * s.rate);
                    const convert = Intl.supportedValuesOf("currency").includes(t) ? new Intl.NumberFormat(undefined, { style: 'currency', currency: t }).format(number) : number;
                    setTo(convert)
                }
                catch (e) {
                    console.error('oops', e);
                }
            }
        })();
    }, [fro, t, fromf])

    return (
        <>
            <input type="number" step="any" value={from} onChange={e => { setFrom(Math.abs(Number(e.target.value))); setTimeout(() => { setFromf(e.target.value) }, 1000) }} />
            <span>{to}</span>
        </>
    )
}
