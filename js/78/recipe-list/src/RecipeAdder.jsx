import './App.css'
import { useState } from "react"

export default function AddRecipe({ recipes, onClickButton, onClickCancel }) {

    const [name, setName] = useState('');
    const [image, setImage] = useState('');
    const [ingredients, setIngredients] = useState('');
    const [instructions, setInstructions] = useState('');

    return (
        <>
            <div className="addRecipeForm">
                <div><h3>Recipe Name</h3>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} /></div>
                <div><h3>Image Source</h3>
                    <input type="text" value={image} onChange={e => setImage(e.target.value)} /></div>
                <div> <h3>Ingredients</h3>
                    <input type="text" placeholder='Ingredients, separated by commas' value={ingredients} onChange={e => setIngredients(e.target.value)} /></div>
                <div><h3>Instructions</h3>
                    <input type="text" value={instructions} onChange={e => setInstructions(e.target.value)} /></div>

                <button className="rab" onClick={() => {
                    onClickButton([...recipes, {
                        name: name, image: image, ingredients: ingredients.split(",")
                            .map(i => i.trim())
                            .filter(i => i !== ""), instructions: instructions
                    }]); setName(''); setImage(''); setIngredients(''); setInstructions(''); onClickCancel(false)
                }}>Submit</button>
                <button className="rab" onClick={() => { setName(''); setImage(''); setIngredients(''); setInstructions(''); onClickCancel(false) }}>Cancel</button>
            </div>
        </>
    )
}