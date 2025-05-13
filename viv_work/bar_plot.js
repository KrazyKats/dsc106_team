import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
const DATA_DIR = "../quy_work/Output/jsons";
console.log("Loaded Bar Plot");

async function processJsonFile(idsArray, tag) {
  // Takes in a idsArray and tag, and outputs an array of all contents
  const response = await fetch(`${DATA_DIR}/food_log_tagged_grouped.json`);
  if (!response.ok) {
    console.error(`HTTP error! Status: ${response.status}`);
  }
  const jsonData = await response.json();
  let outputArray = [];
  if (Array.isArray(jsonData)) {
    jsonData.forEach((meal) => {
      let includePatient = idsArray === undefined || idsArray.includes(meal.ID);
      let includeTag = tag === undefined || meal.tags.includes(tag);

      if (includePatient && includeTag) {
        const currObj = {
          calories: meal.calorie,
          carbs: meal.total_carb,
          sugar: meal.sugar,
        };
        outputArray.push(currObj);
      }
    });

    return outputArray;
  }
}

// Call the function
console.log(await processJsonFile(["001"]));