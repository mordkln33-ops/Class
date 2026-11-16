
export default function Address({ name, number, street, city, state, zip }) {
    return (
        <>
            <h2>{name}</h2>
            <h2>{number} {street}</h2>
            <h2>{city}, {state} {zip}</h2>
        </>
    )
}

export function Address2(person) {
    const addR = <>
        <h2>{person.name}</h2>
        <h2>{person.number} {person.street}</h2>
        <h2>{person.city}, {person.state} {person.zip}</h2>
    </>
    return addR;
}

export function Address3(person) {
    return (
        <>
            <h2>{person.name}</h2>
            <h2>{person.number} {person.street}</h2>
            <h2>{person.city}, {person.state} {person.zip}</h2>
        </>
    )
}
