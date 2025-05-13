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
const currentMeal = await processJsonFile(["001"]);
const allMeals = await processJsonFile();
createBarPlot(currentMeal, allMeals);

function createBarPlot(currentMeal, allMeals) {
  const margin = { top: 40, right: 30, bottom: 60, left: 40 };
  const width = 600 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Create SVG container
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Setup scales
  const x0 = d3.scaleBand().rangeRound([0, width]).paddingInner(0.1);

  const x1 = d3.scaleBand().padding(0.05);

  const y = d3.scaleLinear().rangeRound([height, 0]);

  const color = d3.scaleOrdinal().range(["#1f77b4", "#ff7f0e"]);
  function updateChart(currentMeal, allMeals) {
    // Process the data
    const percentages1 = categorizeMealsByCarbs(currentMeal);
    const percentages2 = categorizeMealsByCarbs(allMeals);
  
    const chartData = [
      {
        range: "0-10g",
        "Meal Set 1": percentages1["0-10g"],
        "Meal Set 2": percentages2["0-10g"],
      },
      {
        range: "10-20g",
        "Meal Set 1": percentages1["10-20g"],
        "Meal Set 2": percentages2["10-20g"],
      },
      {
        range: "20-30g",
        "Meal Set 1": percentages1["20-30g"],
        "Meal Set 2": percentages2["20-30g"],
      },
      {
        range: "30+g",
        "Meal Set 1": percentages1["30+g"],
        "Meal Set 2": percentages2["30+g"],
      },
    ];
  
    // Clear previous chart elements
    svg.selectAll("*").remove();
  
    // Setup domains
    const keys = ["Meal Set 1", "Meal Set 2"];
    x0.domain(chartData.map((d) => d.range));
    x1.domain(keys).rangeRound([0, x0.bandwidth()]);
    y.domain([0, d3.max(chartData, (d) => d3.max(keys, (key) => d[key]))]).nice();
  
    // Add x axis
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .append("text")
      .attr("x", width / 2)
      .attr("y", margin.bottom - 10)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .text("Carbohydrate Range");
  
    // Add y axis
    svg
      .append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(null, "s"))
      .append("text")
      .attr("x", -height / 2)
      .attr("y", -30)
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .text("Percentage of Meals (%)");
  
    // Add the bars
    svg
      .append("g")
      .selectAll("g")
      .data(chartData)
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${x0(d.range)},0)`)
      .selectAll("rect")
      .data((d) => keys.map((key) => ({ key, value: d[key], range: d.range })))
      .enter()
      .append("rect")
      .attr("x", (d) => x1(d.key))
      .attr("y", (d) => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => height - y(d.value))
      .attr("fill", (d) => color(d.key))
      .append("title")
      .text((d) => `${d.range}, ${d.key}: ${d.value.toFixed(1)}%`);
  
    // Add value labels on top of the bars
    svg
      .append("g")
      .selectAll("g")
      .data(chartData)
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${x0(d.range)},0)`)
      .selectAll("text")
      .data((d) => keys.map((key) => ({ key, value: d[key], range: d.range })))
      .enter()
      .append("text")
      .attr("x", (d) => x1(d.key) + x1.bandwidth() / 2)
      .attr("y", (d) => y(d.value) - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .text((d) => `${d.value.toFixed(1)}%`);
  
    // Add legend
    const legend = svg
      .append("g")
      .attr("class", "legend")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "end")
      .selectAll("g")
      .data(keys.slice())
      .enter()
      .append("g")
      .attr("transform", (d, i) => `translate(0,${i * 20})`);
  
    legend
      .append("rect")
      .attr("x", width - 19)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", color);
  
    legend
      .append("text")
      .attr("x", width - 24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text((d) => d);
  }
  updateChart(currentMeal, allMeals);
}


// document
//   .getElementById("update-chart")
//   .addEventListener("click", updateChart);



function categorizeMealsByCarbs(meals) {
  const ranges = {
    "0-10g": 0,
    "10-20g": 0,
    "20-30g": 0,
    "30+g": 0,
  };

  meals.forEach((meal) => {
    if (meal.carbs < 10) {
      ranges["0-10g"]++;
    } else if (meal.carbs < 20) {
      ranges["10-20g"]++;
    } else if (meal.carbs < 30) {
      ranges["20-30g"]++;
    } else {
      ranges["30+g"]++;
    }
  });
  const total = meals.length;
  const percentages = {};

  for (const range in ranges) {
    percentages[range] = (ranges[range] / total) * 100;
  }

  return percentages;
}

// Todo: 
// Change carb indices included in the data
// Move index a bit to the right
// Move CSS to different file
// Allow buttons to be selectable for different items