
export default function Calc({ from, rate, symbol, date}) {

    const result = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(from * rate)

    // return result;
    return (
        <>
            <span>{symbol}{result} as of {date}</span>
        </>
    )
}
