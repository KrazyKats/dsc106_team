


console.log("📈 timeline_aggregated.js loaded");

let glucoseDataAgg, foodDataAgg;

Promise.all([
    d3.json("data_website/flattened_glucose.json"),
    d3.json("data_website/food_log_tagged.json")
]).then(([glucoseData, foodData]) => {
    glucoseDataAgg = glucoseData;
    foodDataAgg = foodData;
    updatePlotAgg("all");
});

function updatePlotAgg(tagFilter) {
    const svg = d3.select("#timeline-agg");
    svg.selectAll("*").remove();

    const { aligned, numMeals, numParticipants } = alignAllParticipants(glucoseDataAgg, foodDataAgg, tagFilter);
    const averaged = averageByMinute(aligned);

    drawAggregateLine(averaged, numMeals, numParticipants, tagFilter);
}

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

function drawAggregateLine(data, numMeals, numParticipants, tagFilter) {
    const svg = d3.select("#timeline-agg");
    const width = +svg.attr("width") - 100;
    const height = +svg.attr("height") - 100;

    const xScale = d3.scaleLinear().domain([0, 120]).range([50, width]);
    const yScale = d3.scaleLinear().domain([80, 160]).range([height, 20]);

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

    svg.append("path")
        .datum(data)
        .attr("class", "agg-line")
        .attr("fill", "none")
        .attr("stroke", "#d62728")
        .attr("stroke-width", 3)
        .attr("d", lineGen);

    // Tooltip behavior
    const peak = d3.max(data, d => d.avg);
    const tooltip = d3.select("#tooltip-agg");

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
            tooltip.style("display", "none");
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

    d3.select("#chart-title-agg").text(label);
}

// Tag button behavior
d3.selectAll("#tag-buttons-agg button").on("click", function () {
    const tag = d3.select(this).attr("data-tag");
    d3.selectAll("#tag-buttons-agg button").classed("active", false);
    d3.select(this).classed("active", true);
    updatePlotAgg(tag);
});
