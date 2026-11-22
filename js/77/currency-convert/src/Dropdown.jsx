// import { useEffect, useState } from "react"

export default function Dropdown({ which, onChange, value, currencies }) {


    return (
        <>
            <select id={which} onChange={onChange} value={value}>
                <option hidden>---</option>
                {currencies?.map((r, index) => <option key={index} value={r.iso_code}>{r.iso_code} - {r.name}</option>)}
            </select>
        </>
    )
}

