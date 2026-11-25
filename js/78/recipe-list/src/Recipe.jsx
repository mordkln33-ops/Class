export default function Recipe({ recipe: { name, image, ingredients, instructions } }) {
    return (
        <div>
            <h2 id="name">{name}</h2>
            <img id="picture" src={image} />

            <h3>Ingredients</h3>
            <ul id="ingredients">{ingredients.map((i, index) => <li key={index}>{i}</li>)}</ul>
            <h3>Instructions</h3>
            <p id="instructions">{instructions}</p>
        </div>
    )
}