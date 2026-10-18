const list = document.getElementById('recipes');
const recipeText = document.getElementById('recipeText');
const recipeTitle = document.getElementById('recipeTitle');
const recipeImage = document.getElementById('recipeImage');

try {
    const listRecipes = await fetch('recipes.json');
    const recipeData = await listRecipes.json();
    recipeData.forEach(r => {
        const listItem = document.createElement('option');
        listItem.value = r.id;
        listItem.textContent = r.name;
        list.appendChild(listItem);
    });

    if(!listRecipes.ok){
        throw new Error('List not Found')
    }
    
}
catch(e){
    document.body.innerHTML = '';
    const errorTitle = document.createElement('h1');
    errorTitle.innerText = 'No List Found';
    document.body.appendChild(errorTitle);
}

list.addEventListener("change", async o => {
    recipeText.innerText = '';
    if (o.target.value == "nothing") {
        recipeTitle.innerText = 'Nothing Selected'
        recipeImage.src = 'assets/Placeholder.png';

    } else {
        try {
            const recipe = await fetch(getRecipe(o.target.value));
            const currentRecipe = await recipe.json();

            if (!recipe.ok) {
                throw new Error(`${recipe.status} - ${recipe.statusText}`);
            }
            currentRecipe.ingredients.forEach(i => {
                console.log(i);
                const ing = document.createElement('li');
                ing.innerText = i;
                recipeText.appendChild(ing);
            })
            recipeTitle.innerText = currentRecipe.title;
            recipeImage.src = currentRecipe.image;
        }
        catch (e) {
            console.log(e.Error)
            recipeTitle.innerText = 'Error, recipe not found';
            recipeImage.src = '';
            recipeText.innerText = '';
        }
    }
})

function getRecipe(getId) {
    let link = '';
    recipeData.forEach(r => {
        if (r.id == getId) {
            link = r.link;
        }
    })
    return link;
}

