import RecipeList from './RecipeList'
import NoRecipe from './NoRecipe';
import Header from './Header';
import Recipe from './Recipe';
import RecipeAdder from './RecipeAdder.jsx'
import { useState, useEffect } from 'react'
import './App.css'

export default function App() {
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('https://dummyjson.com/recipes');
        if (!response.ok) {
          throw new Error(`${response.status} - ${response.statusText}`);
        }
        const result = await response.json();
        setRecipes(result.recipes.map(r => ({ name: r.name, image: r.image, ingredients: r.ingredients, instructions: r.instructions })));
      }
      catch (e) {
        console.error('ooops', e);
      }
    })();
  }, []);

  return (
    <>
      <Header></Header>
      <RecipeList recipes={recipes} selectedRecipe={selectedRecipe} onSelectRecipe={setSelectedRecipe} />
      <button className='rab' onClick={() => { setShowForm(true) }}>Add a Recipe</button>
      {recipes[selectedRecipe] ? (
        <Recipe recipe={recipes[selectedRecipe]} />
      ) : (
        <NoRecipe />
      )}
      {showForm && <RecipeAdder recipes={recipes} onClickButton={setRecipes} onClickCancel={setShowForm} />}
    </>
  )
}

