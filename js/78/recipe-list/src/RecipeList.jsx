export default function RecipeList({recipes, selectedRecipe, onSelectRecipe}) {
  return (
    <select id="recipes" value={selectedRecipe} onChange={e => onSelectRecipe(e.target.value)}>
      <option hidden>select a recipe</option>
      {recipes?.map((r, index) => <option key={index} value={index}>{r.name}</option>)}
    </select>
  )
}