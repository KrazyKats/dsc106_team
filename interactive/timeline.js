console.log("📈 timeline.js loaded");

// Global variables to store data
let glucoseDataGlobal, foodDataGlobal;

// Get the data from JSON files and initialize the plot
Promise.all([
    d3.json("data/flattened_glucose.json"),
    d3.json("data/food_log_tagged.json")
]).then(([glucoseData, foodData]) => {
    console.log("📦 Data loaded");
    glucoseDataGlobal = glucoseData;
    foodDataGlobal = foodData;

    updatePlot("all");
});

// Updates plot based on the selected tag
function updatePlot(tagFilter) {
    // Clear previous lines and axes
    const svg = d3.select("#timeline");
    svg.selectAll(".patient-line").remove();
    svg.selectAll("g").remove();
    svg.selectAll("text.axis-label").remove();

    // Get the patient IDs that we care about
    const participantIDs = [...new Set(glucoseDataGlobal.map(d => d.patient_id))];


    const filteredLines = participantIDs.map(pid => {
        // Extract glucose data and food data for the current participant
        const { aligned, mealCount } = extractGlucoseWindows(glucoseDataGlobal, foodDataGlobal, pid, tagFilter);
        // Average glucose data by minute for alignment purposes
        const averaged = averageByMinute(aligned);
        return {
            uid: pid,
            values: averaged,
            mealCount: mealCount
        };
        // Filter out participants with no meals
    }).filter(p => p.values.length > 0);

    // Render the lines using the filtered data
    drawLines(filteredLines);
}

function extractGlucoseWindows(glucoseData, foodData, targetID, tagFilter = "all") {
    const result = [];

    const glucose = glucoseData
        .filter(d => d.patient_id === targetID)
        .map(d => ({
            timestamp: new Date(d.timestamp),
            glucose: +d.glucose
        }));

    const meals = foodData
        .filter(d => d.ID === targetID)
        .filter(d => tagFilter === "all" || (d.tags && d.tags.includes(tagFilter)))
        .map(d => ({
            datetime: new Date(d.datetime)
        }));

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

    return {
        aligned: result,
        mealCount: meals.length
    };
}

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

function drawLines(patients) {
    const svg = d3.select("#timeline");
    const width = +svg.attr("width") - 100;
    const height = +svg.attr("height") - 100;

    const xScale = d3.scaleLinear()
        .domain([0, 120])
        .range([50, width]);

    const yScale = d3.scaleLinear()
        .domain([80, 170])
        .range([height, 20]);

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

    const tooltip = d3.select("#tooltip");

    svg.selectAll(".patient-line")
        .data(patients)
        .enter()
        .append("path")
        .attr("class", "patient-line")
        .attr("fill", "none")
        .attr("stroke", (_, i) => d3.schemeTableau10[i % 10])
        .attr("stroke-width", 2)
        .attr("d", d => lineGen(d.values))
        .on("mouseover", function(event, d) {
            d3.select(this).raise().attr("stroke-width", 3).attr("opacity", 1);
            svg.selectAll(".patient-line").filter(p => p !== d).attr("opacity", 0.2);

            tooltip.style("display", "block")
                .html(`
                    <strong>Participant:</strong> ${d.uid}<br>
                    <strong># Meals:</strong> ${d.mealCount}<br>
                    <strong>Peak Glucose:</strong> ${Math.round(d3.max(d.values, v => v.avg))} mg/dL
                `);
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            svg.selectAll(".patient-line")
                .attr("opacity", 0.6)
                .attr("stroke-width", 2);
            tooltip.style("display", "none");
        });
}

// Button click behavior
d3.selectAll("#tag-buttons button").on("click", function() {
    const tag = d3.select(this).attr("data-tag");

    // Update button style
    d3.selectAll("#tag-buttons button").classed("active", false);
    d3.select(this).classed("active", true);

    // Update title
    let label;
    if (tag === "all") {
        label = "Average Glucose Response for All Meals";
    } else if (tag === "drink") {
        label = "Average Glucose Response for Drinks";
    } else if (tag === "snack") {
        label = "Average Glucose Response for Snacks";
    } else if (tag === "dessert") {
        label = "Average Glucose Response for Desserts";
    } else {
        label = `Average Glucose Response for ${tag.charAt(0).toUpperCase() + tag.slice(1)} Meals`;
    }


    d3.select("#chart-title").text(label);

    updatePlot(tag);
});
