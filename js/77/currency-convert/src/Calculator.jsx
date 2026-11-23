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
    const [fsymbol, setFSymbol] = useState('');
    const [date, setDate] = useState('');
    const [fFlag, setFFlag] = useState('');
    const [tFlag, setTFlag] = useState('');
    const currencyFlags = {
        AED: "ae",
        AFN: "af",
        ALL: "al",
        AMD: "am",
        AOA: "ao",
        ARS: "ar",
        AUD: "au",
        AWG: "aw",
        AZN: "az",
        BAM: "ba",
        BBD: "bb",
        BDT: "bd",
        BHD: "bh",
        BIF: "bi",
        BMD: "bm",
        BND: "bn",
        BOB: "bo",
        BRL: "br",
        BSD: "bs",
        BTN: "bt",
        BWP: "bw",
        BYN: "by",
        BZD: "bz",
        CAD: "ca",
        CDF: "cd",
        CHF: "ch",
        CLP: "cl",
        CNH: "cn",
        CNY: "cn",
        COP: "co",
        CRC: "cr",
        CUP: "cu",
        CVE: "cv",
        CZK: "cz",
        DJF: "dj",
        DKK: "dk",
        DOP: "do",
        DZD: "dz",
        EGP: "eg",
        ERN: "er",
        ETB: "et",
        EUR: "eu",
        FJD: "fj",
        FKP: "fk",
        GBP: "gb",
        GEL: "ge",
        GGP: "gg",
        GHS: "gh",
        GIP: "gi",
        GMD: "gm",
        GNF: "gn",
        GTQ: "gt",
        GYD: "gy",
        HKD: "hk",
        HNL: "hn",
        HTG: "ht",
        HUF: "hu",
        IDR: "id",
        ILS: "il",
        IMP: "im",
        INR: "in",
        IQD: "iq",
        IRR: "ir",
        ISK: "is",
        JEP: "je",
        JMD: "jm",
        JOD: "jo",
        JPY: "jp",
        KES: "ke",
        KGS: "kg",
        KHR: "kh",
        KMF: "km",
        KPW: "kp",
        KRW: "kr",
        KWD: "kw",
        KYD: "ky",
        KZT: "kz",
        LAK: "la",
        LBP: "lb",
        LKR: "lk",
        LRD: "lr",
        LSL: "ls",
        LYD: "ly",
        MAD: "ma",
        MDL: "md",
        MGA: "mg",
        MKD: "mk",
        MMK: "mm",
        MNT: "mn",
        MOP: "mo",
        MRU: "mr",
        MUR: "mu",
        MVR: "mv",
        MWK: "mw",
        MXN: "mx",
        MYR: "my",
        MZN: "mz",
        NAD: "na",
        NGN: "ng",
        NIO: "ni",
        NOK: "no",
        NPR: "np",
        NZD: "nz",
        OMR: "om",
        PAB: "pa",
        PEN: "pe",
        PGK: "pg",
        PHP: "ph",
        PKR: "pk",
        PLN: "pl",
        PYG: "py",
        QAR: "qa",
        RON: "ro",
        RSD: "rs",
        RUB: "ru",
        RWF: "rw",
        SAR: "sa",
        SBD: "sb",
        SCR: "sc",
        SDG: "sd",
        SEK: "se",
        SGD: "sg",
        SHP: "sh",
        SLE: "sl",
        SOS: "so",
        SRD: "sr",
        SSP: "ss",
        STN: "st",
        SVC: "sv",
        SYP: "sy",
        SZL: "sz",
        THB: "th",
        TJS: "tj",
        TMT: "tm",
        TND: "tn",
        TOP: "to",
        TRY: "tr",
        TTD: "tt",
        TWD: "tw",
        TZS: "tz",
        UAH: "ua",
        UGX: "ug",
        USD: "us",
        UYU: "uy",
        UZS: "uz",
        VES: "ve",
        VND: "vn",
        VUV: "vu",
        WST: "ws",
        YER: "ye",
        ZAR: "za",
        ZMW: "zm",
        ZWG: "zw",

        // Shared currencies / accounting units without a single flag
        ANG: null, // Netherlands Antillean guilder
        CMD: null, // COMESA dollar
        XAF: null, // Central African CFA franc
        XCD: null, // East Caribbean dollar
        XCG: null, // Caribbean guilder
        XDR: null, // Special drawing rights
        XOF: null, // West African CFA franc
        XPF: null, // CFP franc

        // Precious metals
        XAG: null,
        XAU: null,
        XPD: null,
        XPT: null,

        // Cryptocurrencies
        AAVE: null,
        ADA: null,
        ALGO: null,
        APT: null,
        ARB: null,
        ATOM: null,
        AVAX: null,
        AXS: null,
        BCH: null,
        BTC: null,
        CHZ: null,
        CRV: null,
        DOT: null,
        ENA: null,
        ETC: null,
        ETH: null,
        FIL: null,
        HBAR: null,
        ICP: null,
        LINK: null,
        LTC: null,
        MANA: null,
        NEAR: null,
        ONDO: null,
        POL: null,
        SNX: null,
        SOL: null,
        SUI: null,
        UNI: null,
        USDC: null,
        USDT: null,
        XLM: null,
        XRP: null,
        XTZ: null,
        ZEC: null
    };


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
                    setFSymbol(currencies.find(item => item.iso_code === fromCur).symbol)
                    setFFlag(`https://flagcdn.com/w80/${currencyFlags[fromCur]}.png`)
                    setTFlag(`https://flagcdn.com/w80/${currencyFlags[toCur]}.png`)
                }
                catch (e) {
                    console.error('oops', e);
                }
            }
        })();
    }, [fromCur, toCur, currencies])

    return <>
        <h2>Input Amount</h2>
        <div className="sCurDiv">
            <input type="number" step="any" value={inputAmount} onChange={e => { setInputAmount(Math.abs(Number(e.target.value))); setTimeout(() => { setAmount(e.target.value) }, 1000) }} />
        </div>
        <div className="curDiv">
            <div className="sCurDiv" style={{
                backgroundImage: `linear-gradient(
                    rgba(255, 255, 255, 0.7),
                    rgba(255, 255, 255, 0.7),
                     url("${fFlag}"))`,
                backgroundSize: "fill",
                backgroundPosition: "center"
            }}>
                <h2>From Currency</h2>
                <Dropdown which='1st' onChange={e => { setFromCur(e.target.value) }} value={fromCur} currencies={currencies}></Dropdown>
                <span>{fsymbol}{amount}</span>
            </div>
            <button className="switchB" onClick={() => { setFromCur(toCur); setToCur(fromCur) }}>switch</button >
            <div className="sCurDiv" style={{
                backgroundImage: `linear-gradient(
                    rgba(255, 255, 255, 0.7),
                    rgba(255, 255, 255, 0.7),
                     url("${tFlag}"))`,
                backgroundSize: "fill",
                backgroundPosition: "center"
            }}>
                <h2>To Currency</h2>
                <Dropdown which='2nd' onChange={e => { setToCur(e.target.value); console.log({ toCur }) }} value={toCur} currencies={currencies}>
                </Dropdown>
                <Calc from={amount} rate={rate} symbol={symbol} date={date} />
            </div>
        </div >
    </>
}