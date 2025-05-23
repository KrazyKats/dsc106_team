console.log("📈 Combined timeline.js loaded");
import { loadDataAndPlot } from "./bar_plot.js";
// Global variables to store data
let glucoseDataGlobal, foodDataGlobal;
// Array to store clicked patient IDs
const clickedPatientIDs = [];
// Variable to track currently selected tag
let currentTag = "all";

// Load data and initialize the plot
Promise.all([
    d3.json("data_website/flattened_glucose.json"),
    d3.json("data_website/food_log_tagged.json")
]).then(([glucoseData, foodData]) => {
    console.log("📦 Data loaded");
    glucoseDataGlobal = glucoseData;
    foodDataGlobal = foodData;

    // Initialize both plots
    updateCombinedPlot("all");
    
    // Initialize the bar plot with default parameters (no selections)
    loadDataAndPlot(false, undefined, undefined);
});

function extractGlucoseWindows(glucoseData, foodData, targetID, tagFilter = "all") {
    const result = [];

    // Filter glucose data for the target patient
    const glucose = glucoseData
        .filter(d => d.patient_id === targetID)
        .map(d => ({
            timestamp: new Date(d.timestamp), // Convert timestamp to Date object
            glucose: +d.glucose // Ensure glucose is a number
        }));

    // Filter meal data for the target patient and tag
    const meals = foodData
        .filter(d => d.ID === targetID) // Match patient ID
        .filter(d => tagFilter === "all" || (d.tags && d.tags.includes(tagFilter))) // Match tag
        .map(d => ({
            datetime: new Date(d.datetime) // Convert datetime to Date object
        }));

    // Align glucose readings with meals
    meals.forEach(meal => {
        const mealTime = meal.datetime;
        glucose.forEach(g => {
            const diffMin = (g.timestamp - mealTime) / (1000 * 60); // Time difference in minutes
            if (diffMin >= 0 && diffMin <= 120) { // Include readings within 0 to 120 minutes after the meal
                result.push({
                    timeSinceMeal: Math.round(diffMin / 5) * 5, // Round to the nearest 5 minutes
                    glucose: g.glucose
                });
            }
        });
    });

    return {
        aligned: result, // Aligned glucose readings
        mealCount: meals.length // Number of meals for the patient
    };
}

// Function to update the combined plot
function updateCombinedPlot(tagFilter) {
    const svg = d3.select("#timeline");
    svg.selectAll("*").remove(); // Clear previous lines and axes

    // Get individual patient lines
    const participantIDs = [...new Set(glucoseDataGlobal.map(d => d.patient_id))];
    const filteredLines = participantIDs.map(pid => {
        const { aligned, mealCount } = extractGlucoseWindows(glucoseDataGlobal, foodDataGlobal, pid, tagFilter);
        const averaged = averageByMinute(aligned);
        return {
            uid: pid,
            values: averaged,
            mealCount: mealCount
        };
    }).filter(p => p.values.length > 0);

    // Get aggregated line
    const { aligned, numMeals, numParticipants } = alignAllParticipants(glucoseDataGlobal, foodDataGlobal, tagFilter);
    const aggregatedLine = averageByMinute(aligned);

    // Draw both individual and aggregated lines
    drawCombinedLines(filteredLines, aggregatedLine, numMeals, numParticipants, tagFilter);
}

// Function to align all participants' data for aggregation
function alignAllParticipants(glucoseData, foodData, tagFilter = "all") {
    const result = [];
    let mealCount = 0;
    let contributingParticipants = new Set();

    const participantIDs = [...new Set(glucoseData.map(d => d.patient_id))];

    participantIDs.forEach(pid => {
        const glucose = glucoseData
            .filter(d => d.patient_id === pid)
            .map(d => ({
                timestamp: new Date(d.timestamp),
                glucose: +d.glucose
            }));

        const meals = foodData
            .filter(d => d.ID === pid)
            .filter(d => tagFilter === "all" || (d.tags && d.tags.includes(tagFilter)))
            .map(d => ({
                datetime: new Date(d.datetime)
            }));

        if (meals.length > 0) {
            contributingParticipants.add(pid);
        }

        mealCount += meals.length;

        meals.forEach(meal => {
            const mealTime = meal.datetime;
            glucose.forEach(g => {
                const diffMin = (g.timestamp - mealTime) / (1000 * 60);
                if (diffMin >= 0 && diffMin <= 120) {
                    result.push({
                        timeSinceMeal: Math.round(diffMin / 5) * 5,
                        glucose: g.glucose
                    });
                }
            });
        });
    });

    return {
        aligned: result,
        numMeals: mealCount,
        numParticipants: contributingParticipants.size
    };
}

// Function to average glucose data by minute
function averageByMinute(aligned) {
    const binMap = d3.rollup(
        aligned,
        v => d3.mean(v, d => d.glucose),
        d => d.timeSinceMeal
    );

    return Array.from(binMap, ([minute, avg]) => ({
        minute: +minute,
        avg: +avg
    })).sort((a, b) => a.minute - b.minute);
}

// Function to update the bar plot based on current selections
function updateBarPlot() {
    // Clear previous plot
    d3.select("#chart").selectAll("*").remove();
    
    // Determine if we need two plots based on selections
    const twoPlots = clickedPatientIDs.length > 0;
    
    // Get the IDs array (undefined if none selected)
    const idsArray = clickedPatientIDs.length > 0 ? clickedPatientIDs : undefined;
    
    // Get the tag (undefined if 'all' is selected)
    const tag = currentTag !== "all" ? currentTag : undefined;
    
    // Call loadDataAndPlot with the appropriate parameters
    loadDataAndPlot(twoPlots, idsArray, tag);
}

// Function to draw both individual and aggregated lines
// Function to draw both individual and aggregated lines
function drawCombinedLines(patients, aggregatedLine, numMeals, numParticipants, tagFilter) {
    const svg = d3.select("#timeline");
    const width = +svg.attr("width") - 100;
    const height = +svg.attr("height") - 50;

    const xScale = d3.scaleLinear().domain([0, 120]).range([50, width]);
    const yScale = d3.scaleLinear().domain([80, 170]).range([height, 20]);

    const xAxis = d3.axisBottom(xScale).tickValues(d3.range(0, 125, 10));
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis);
    svg.append("g")
        .attr("transform", `translate(50, 0)`)
        .call(yAxis);

    // Axis labels
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", (width + 50) / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text("Minutes Since Meal");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .text("Average Glucose (mg/dL)");

    const lineGen = d3.line()
        .x(d => xScale(d.minute))
        .y(d => yScale(d.avg));

    // Create a tooltip for displaying patient IDs
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "5px")
        .style("border-radius", "5px")
        .style("display", "none")
        .style("pointer-events", "none");

    // Draw individual patient lines
    svg.selectAll(".patient-line")
        .data(patients)
        .enter()
        .append("path")
        .attr("class", "patient-line")
        .attr("fill", "none")
        .attr("stroke", (_, i) => d3.schemeTableau10[i % 10])
        .attr("stroke-width", 5) // Keep the thickness consistent
        .attr("d", d => lineGen(d.values))
        .attr("opacity", 0.6)
        .style("cursor", "pointer") // Add pointer cursor for better UX
        .each(function (d) {
            // Reapply the "selected" class if the patient ID is in clickedPatientIDs
            if (clickedPatientIDs.includes(d.uid)) {
                d3.select(this).classed("selected", true);
            }
        })
        .on("mouseover", function (event, d) {
            // Show the tooltip with the patient ID
            tooltip.style("display", "block")
                .html(`<strong>Patient ID:</strong> ${d.uid}`);
        })
        .on("mousemove", function (event) {
            // Move the tooltip with the mouse
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
            // Hide the tooltip when the mouse leaves the line
            tooltip.style("display", "none");
        })
        .on("click", function (event, d) {
            const line = d3.select(this);

            // Toggle the patient ID in the clickedPatientIDs array
            const index = clickedPatientIDs.indexOf(d.uid);
            if (index === -1) {
                clickedPatientIDs.push(d.uid);
                console.log(`Patient ID ${d.uid} added to clickedPatientIDs.`);
                line.classed("selected", true); // Add highlight class
            } else {
                clickedPatientIDs.splice(index, 1);
                console.log(`Patient ID ${d.uid} removed from clickedPatientIDs.`);
                line.classed("selected", false); // Remove highlight class
            }

            // Update the display of selected patient IDs
            updateSelectedPatients();

            // Dim unselected lines
            svg.selectAll(".patient-line")
                .attr("opacity", line => clickedPatientIDs.length === 0 || clickedPatientIDs.includes(line.uid) ? 0.6 : 0.2);
                
            // Update the bar plot with new selections
            updateBarPlot();
        });

    // Draw aggregated line
    svg.append("path")
        .datum(aggregatedLine)
        .attr("class", "agg-line")
        .attr("fill", "none")
        .attr("stroke", "#d62728") // Red color for the aggregated line
        .attr("stroke-width", 5) // Slightly thicker for emphasis
        .attr("stroke-dasharray", "5,5") // Make the line dotted
        .attr("d", lineGen);

    // Tooltip behavior for aggregated line
    const peak = d3.max(aggregatedLine, d => d.avg);
    svg.selectAll(".agg-line")
        .on("mouseover", function () {
            tooltip.style("display", "block")
                .html(`
                    <strong>Total Meals:</strong> ${numMeals}<br>
                    <strong>Participants:</strong> ${numParticipants}<br>
                    <strong>Peak Glucose:</strong> ${Math.round(peak)} mg/dL
                `);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
            tooltip
                .style("display", "none");
        });

    // Title logic
    let label;
    if (tagFilter === "all") {
        label = "Average Glucose Response for All Meals";
    } else if (tagFilter === "drink") {
        label = "Average Glucose Response for Drinks";
    } else if (tagFilter === "snack") {
        label = "Average Glucose Response for Snacks";
    } else if (tagFilter === "dessert") {
        label = "Average Glucose Response for Desserts";
    } else {
        label = `Average Glucose Response for ${tagFilter.charAt(0).toUpperCase() + tagFilter.slice(1)} Meals`;
    }

    d3.select("#chart-title").text(label);
}

// Function to update the display of selected patient IDs
function updateSelectedPatients() {
    const selectedContainer = d3.select("#selected-patients");
    selectedContainer.html(""); // Clear previous content

    if (clickedPatientIDs.length === 0) {
        selectedContainer.append("p").text("No patients selected. Showing data for all patients.");
    } else {
        selectedContainer.append("p").text("Selected Patient IDs:");
        selectedContainer.append("ul")
            .selectAll("li")
            .data(clickedPatientIDs)
            .enter()
            .append("li")
            .text(d => d);
    }
}

// Button click behavior
d3.selectAll("#tag-buttons button").on("click", function () {
    const tag = d3.select(this).attr("data-tag");
    
    // Store the current tag selection
    currentTag = tag;

    // Update button style
    d3.selectAll("#tag-buttons button").classed("active", false);
    d3.select(this).classed("active", true);

    // Update the timeline visualization
    updateCombinedPlot(tag);
    
    // Update the bar plot with new selections
    updateBarPlot();
});