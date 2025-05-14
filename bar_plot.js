import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const DATA_DIR = "./quy_work/Output/jsons";
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
function createBarPlot(
  mealSet1,
  mealSet2,
  usedRanges,
  axisLabels,
  options = {}
) {
  // Check if we have data to plot
  if (!mealSet1 || mealSet1.length === 0) {
    console.error("No data available for the first meal set");
    return;
  }

  // Default options
  const defaultOptions = {
    set1Label: "Meal Set 1",
    set2Label: "Meal Set 2",
    title: null,
    colors: null,
  };

  // Merge provided options with defaults
  const mergedOptions = { ...defaultOptions, ...options };

  // Clear previous chart if any exists
  d3.select("#chart svg").remove();

  const margin = { top: 40, right: 150, bottom: 60, left: 40 };
  const width = 800 - margin.left - margin.right;
  const height = 600 - margin.top - margin.bottom;

  // Create SVG container
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Add title to the chart
  const chartTitle =
    mergedOptions.title ||
    (isSingleDataset
      ? mergedOptions.set1Label
      : "Comparison: " +
        mergedOptions.set1Label +
        " vs " +
        mergedOptions.set2Label);

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -margin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text(chartTitle);

  // Setup scales
  const x0 = d3.scaleBand().rangeRound([0, width]).paddingInner(0.1);
  const x1 = d3.scaleBand().padding(0.05);
  const y = d3.scaleLinear().rangeRound([height, 0]);

  // Determine if we're showing one or two datasets
  const isSingleDataset = mealSet2 === null || mealSet2 === undefined;

  // Set color scale based on number of datasets
  const defaultColors = isSingleDataset
    ? ["#4285F4"] // Single color for one dataset - nice blue
    : ["#4285F4", "#EA4335"]; // Google-like blue and red for better contrast

  const colors = mergedOptions.colors || defaultColors;
  const color = d3.scaleOrdinal().range(colors);

  // Process the data for the first meal set
  const percentages1 = categorizeMealsByCarbs(mealSet1, usedRanges);

  // Prepare chart data based on whether we have one or two datasets
  let chartData = [];
  let keys = [];

  if (isSingleDataset) {
    // For single dataset
    const label = mergedOptions.set1Label;
    keys = [label];

    chartData = axisLabels.map((label, index) => {
      const obj = { range: label };

      if (index < usedRanges.length) {
        obj[keys[0]] = percentages1[usedRanges[index]];
      } else {
        obj[keys[0]] = percentages1.greater;
      }

      return obj;
    });
  } else {
    // For two datasets
    const percentages2 = categorizeMealsByCarbs(mealSet2, usedRanges);
    keys = [mergedOptions.set1Label, mergedOptions.set2Label];

    chartData = axisLabels.map((label, index) => {
      const obj = { range: label };

      if (index < usedRanges.length) {
        obj[mergedOptions.set1Label] = percentages1[usedRanges[index]];
        obj[mergedOptions.set2Label] = percentages2[usedRanges[index]];
      } else {
        obj[mergedOptions.set1Label] = percentages1.greater;
        obj[mergedOptions.set2Label] = percentages2.greater;
      }

      return obj;
    });
  }

  // Setup domains
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

  // Add legend - moved to the right side with improved positioning
  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr("font-family", "sans-serif")
    .attr("font-size", 10)
    .attr("text-anchor", "start")
    .selectAll("g")
    .data(keys)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(${width + 20},${20 + i * 25})`); // More spacing between legend items

  legend
    .append("rect")
    .attr("x", 0)
    .attr("width", 18)
    .attr("height", 18)
    .attr("fill", color);

  legend
    .append("text")
    .attr("x", 24)
    .attr("y", 9)
    .attr("dy", "0.32em")
    .text((d) => d)
    .each(function (d) {
      // Get the computed text width and ensure it fits
      const textWidth = this.getComputedTextLength();
      if (textWidth > margin.right - 50) {
        d3.select(this).attr("textLength", margin.right - 50);
      }
    });
}

function categorizeMealsByCarbs(meals, usedRanges) {
  // Bins the meals by carbohydrate content
  const ranges = Object.fromEntries(usedRanges.map((key) => [key, 0]));
  ranges.greater = 0;

  meals.forEach((meal) => {
    let noMatches = true;
    for (const range of usedRanges) {
      if (meal.carbs <= range) {
        ranges[range]++;
        noMatches = false;
        break;
      }
    }
    if (noMatches) {
      ranges.greater++;
    }
  });
  const total = meals.length;
  const percentages = {};

  for (const range in ranges) {
    percentages[range] = (ranges[range] / total) * 100;
  }

  return percentages;
}

export async function loadDataAndPlot(twoPlots, idsArray, tag) {
  /*
  Parameters:
  Two Plots 
  if false, only average meal data. 
  if true, average meal data and selected meal data from idsArray and tag

  idsArray:
  All IDs of patients to include in the plot. If undefined, all patients are included.
  tag: The tag to filter meals by. If undefined, all meals are included.
  */
  let currentMeal;
  let allMeals;
  if (twoPlots) {
    currentMeal = await processJsonFile(idsArray, tag);
    allMeals = await processJsonFile();
  } else {
    currentMeal = await processJsonFile();
    allMeals = null;
  }
  const usedRanges = [10, 25, 50];
  const axisLabels = ["0-10g", "10-25g", "25-50g", "50+g"];
  if (twoPlots) {
    createBarPlot(currentMeal, allMeals, usedRanges, axisLabels, {
      set1Label: "Selected Data",
      set2Label: "All Data",
      title:
        "Are Carbs in Selected Meals Different From Average Meal in Dataset?",
      colors: ["#4285F4", "#EA4335"],
    });
  }
  else {
    createBarPlot(currentMeal, null, usedRanges, axisLabels, {
      set1Label: "All Meals",
      title: "Carbohydrates Distribution for All Patients",
    });
  }
}
// loadDataAndPlot(true, undefined, "breakfast");
