// Global state
let schools = [];
let selectedSchool = "";
let campusScore = "Fair"; // Default campus score
let useCampusScoreToday = false;

let thresholds = {
  utilization: 105,
  fundingFactor: 0.4,
    renovationFundingFactor: 0.4,
    modifiedAge: 30,
    modifiedAge2: 20,
    systemsDeficient: 3,
    minorSystemsDeficient: 1,
    campusScore: 3, 
    eaIndex: 4 // 0 = N/A, 1 = Poor, 2 = Fair, 3 = Good, 4 = Excellent
};
let gradeChoices; // keep this global to manage re-init

function getSelectedGrades() {
  const select = document.getElementById("grade-filter");
  return Array.from(select.selectedOptions).map(opt => opt.value);
}

function filterByGrade(school) {
  const selectedGrades = getSelectedGrades();
  const schoolGrade = (school.gradesServed || "").trim().toLowerCase();
  return selectedGrades.includes(schoolGrade);
}




document.addEventListener("DOMContentLoaded", () => {
  // Collapsible logic
  window.toggleCollapse = function(sectionId) {
    const section = document.getElementById(sectionId);
    const btn = document.getElementById('btn-' + sectionId);
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      section.style.display = 'none';
      btn.textContent = '+';
      btn.setAttribute('aria-expanded', 'false');
    } else {
      section.style.display = '';
      btn.textContent = '−';
      btn.setAttribute('aria-expanded', 'true');
    }
  };


  
  // Load CSV
  Papa.parse("Decision_Flow_Data.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function (res) {
      schools = res.data.map(row => ({
  name: row["School Name"] || row["School (Full) Name"] || "",
  gradesServed: row["Grades Served"] || "",
  currentEnrollment: row["Current Enrollment (SY 24-25)"] || "",
  projectedEnrollment: row["Projected Enrollment (SY 33-34)"] || "",
  stateRatedCapacity: row["State Rated Capacity"] || "",
  utilization: parseFloat(row["Utilization (SY33-34) (Percent)"] || "0"),
  utilizationToday: parseFloat(row["Utilization (SY24-25) (Percent)"] || "0"),
  fundingFactor: parseFloat((row["State Funding Score"] || "0").replace('%', '')) / 100,
  schoolType: parseSchoolType(row["Grades Served"]),
  campusScore: normalizeCampusScore(row["FCA Campus Grade (34/35)"]),
  campusScoreToday: normalizeCampusScore(row["Building Size Adequacy"]),
  eaValue: (() => {
    const raw = (row["EA Value"] || "").trim();
    return eaLabels.includes(raw) ? raw : "N/A";
  })(),
  modifiedAge: parseInt(row["Modified Building Age"] || "0", 10),
  historicBuilding: (row["Historic Building"] || "").trim().toLowerCase() === "yes",
  fairOrDeficientCount: parseFloat(row["System"] || 0),
}));

      populateGradeFilterDropdown();
      populateSchoolSummaryTable(schools);
      enableSchoolTableSorting();
      populateSchoolDropdown();
      updateSummary();
      setTimeout(updateFutureSummary, 0);  // Ensure future summary updates after DOM is ready
      initializeFlowchart();
      drawFutureFlowchart();
      attachEventListeners();
      document.getElementById("loading").style.display = "none";
      document.getElementById("flowchart-svg").style.display = "";
    },
    error: function (err) {
      alert("Failed to load CSV: " + err);
    }
  });
});

// Helpers
function normalizeCampusScore(raw) {
  const cleaned = (raw || "").trim().toLowerCase();
  const normalized = campusScoreLabels.find(label =>
    label.toLowerCase() === cleaned
  );
  return normalized ? campusScoreLabels.indexOf(normalized) : null;
}

function parseSchoolType(gradesServed) {
  return getSchoolType(gradesServed || "");
}


function getSchoolType(grades) {
  if (/K|1|2|3|4|5/.test(grades)) return "elementary";
  if (/6|7|8/.test(grades)) return "middle";
  if (/9|10|11|12/.test(grades)) return "high";
  return "other";
}

function populateSchoolDropdown() {
  const schoolSelect = document.getElementById("school-select");
  const selected = schoolSelect.value;
  schoolSelect.innerHTML = '<option value="">-- Select Building --</option>';

  schools
    .filter(filterByGrade)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(school => {
      const option = document.createElement("option");
      option.value = school.name;
      option.textContent = school.name;
      schoolSelect.appendChild(option);
    });

  schoolSelect.value = selected; // try to preserve selection
}


function populateGradeFilterDropdown() {
  const select = document.getElementById("grade-filter");
  const values = [...new Set(schools.map(s => s.gradesServed?.trim().toLowerCase()))]
    .filter(Boolean)
    .sort();

  select.innerHTML = "";
  values.forEach(val => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val.replace(/\b\w/g, c => c.toUpperCase());
    select.appendChild(option);
  });

  // Destroy existing instance before reinitializing
  if (gradeChoices) gradeChoices.destroy();

  // Initialize Choices.js
  gradeChoices = new Choices(select, {
    removeItemButton: true,
    placeholder: true,
    placeholderValue: "Filter by Building Type",
    searchEnabled: true,
    shouldSort: false
  });
}



document.getElementById("school-summary-filter").addEventListener("input", filterTable);
document.getElementById("school-summary-column").addEventListener("change", filterTable);

function filterTable() {
  const filterText = document.getElementById("school-summary-filter").value.toLowerCase();
  const columnIndex = document.getElementById("school-summary-column").value;
  const rows = document.querySelectorAll("#school-summary-table tbody tr");

  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    let match = false;

    if (columnIndex === "all") {
      // Search across all columns
      match = [...cells].some(td => td.textContent.toLowerCase().includes(filterText));
    } else {
      // Search in the selected column only
      const colText = cells[parseInt(columnIndex)].textContent.toLowerCase();
      match = colText.includes(filterText);
    }

    row.style.display = match ? "" : "none";
  });
}

//Select from dropdown
function attachEventListeners() {
  document.getElementById("school-select").addEventListener("change", e => {
    const selectedSchool = e.target.value;
    showSchoolInfo(selectedSchool);
    highlightPath(selectedSchool);           // First flowchart
    highlightFuturePath(selectedSchool);     // Second flowchart
  });

document.getElementById("grade-filter").addEventListener("change", () => {
  populateSchoolDropdown();
  populateSchoolSummaryTable(schools);
  updateSummary();
  updateFutureSummary();
  rehighlightSelectedSchool();
});


// Flowchart 1 sliders
  document.getElementById("utilization-slider").addEventListener("input", e => {
    thresholds.utilization = parseInt(e.target.value, 10);
    document.getElementById("util-out").textContent = thresholds.utilization;
    updateSummary();
    updateFlowchart();
    populateSchoolSummaryTable(schools);
  });

  document.getElementById("funding-slider").addEventListener("input", e => {
    thresholds.fundingFactor = parseFloat(e.target.value);
    document.getElementById("funding-out").textContent = thresholds.fundingFactor;
    updateSummary();
    updateFlowchart();
    populateSchoolSummaryTable(schools);
  });

  
      document.getElementById("elementary-slider").addEventListener("input", e => {
        thresholds.elementary = parseInt(e.target.value, 10);
        document.getElementById("elementary-out").textContent = thresholds.elementary;
        updateSummary();
        updateFlowchart();
        populateSchoolSummaryTable(schools);
      });

      document.getElementById("middle-slider").addEventListener("input", e => {
        thresholds.middle = parseInt(e.target.value, 10);
        document.getElementById("middle-out").textContent = thresholds.middle;
        updateSummary();
        updateFlowchart();
        populateSchoolSummaryTable(schools);
      });

      document.getElementById("high-slider").addEventListener("input", e => {
        thresholds.high = parseInt(e.target.value, 10);
        document.getElementById("high-out").textContent = thresholds.high;
        updateSummary();
        updateFlowchart();
        populateSchoolSummaryTable(schools);
      });
    }


    //Right Side Flowchart Sliders
const campusScoreLabels = ["N/A", "", "Significantly Constrained", "Constrained", "No Constraints"];


document.getElementById("campus-score-slider").addEventListener("input", e => {
  const rawValue = parseInt(e.target.value, 10);


  thresholds.campusScore = rawValue;
  document.getElementById("campus-score-out").textContent = campusScoreLabels[rawValue]; // for display

  
  const campusScoreLabel = campusScoreLabels[rawValue] || "Unknown";
document.getElementById("campus-score-label").textContent = campusScoreLabel;

  const selected = document.getElementById("school-select").value;
  drawFutureFlowchart(selected);
  highlightFuturePath(selected);
  updateFutureSummary();
  populateSchoolSummaryTable(schools);

});

    document.getElementById("campus-score-mode").addEventListener("change", (e) => {
      useCampusScoreToday = e.target.value === "today";
      thresholds.campusScore = parseInt(document.getElementById("campus-score-slider").value, 10);
      drawFutureFlowchart();                  // redraw flowchart
      highlightFuturePath(document.getElementById("school-select").value); // update path
      updateFutureSummary();                 // update summary table
      populateSchoolSummaryTable(schools);   // refresh full school table
    });

  const eaLabels = ["N/A", "", "Significantly Constrained", "Constrained", "No Constraints"];
    document.getElementById("ea-slider").addEventListener("input", e => {
      const rawValue = parseInt(e.target.value, 10);

      thresholds.eaIndex = rawValue;
      document.getElementById("ea-out").textContent = eaLabels[rawValue];
      const selected = document.getElementById("school-select").value;
      drawFutureFlowchart(selected); // Redraw the flowchart
      highlightFuturePath(selected); // Highlight the updated path
      updateFutureSummary(); // Update the summary table
      populateSchoolSummaryTable(schools);
    });


      document.getElementById("renovation-funding-slider").addEventListener("input", e => {
      thresholds.renovationFundingFactor = parseFloat(e.target.value);
      document.getElementById("renovation-funding-out").textContent = thresholds.renovationFundingFactor;
      const selected = document.getElementById("school-select").value;
      drawFutureFlowchart(selected); // Redraw the flowchart
      highlightFuturePath(selected); // Highlight the updated path
      updateFutureSummary(); // Update the summary table
      populateSchoolSummaryTable(schools);
    });


      document.getElementById("modAge-slider").addEventListener("input", e => {
        const val = parseInt(e.target.value, 10);
        thresholds.modifiedAge = val;
        document.getElementById("modAge-out").textContent = val;
        const selected = document.getElementById("school-select").value;
      drawFutureFlowchart(selected); // Redraw the flowchart
      highlightFuturePath(selected); // Highlight the updated path
      updateFutureSummary(); // Update the summary table
      populateSchoolSummaryTable(schools);
      });

      document.getElementById("modAge2-slider").addEventListener("input", e => {
        const val = parseInt(e.target.value, 10);
        thresholds.modifiedAge2 = val;
        document.getElementById("modAge2-out").textContent = val;
      const selected = document.getElementById("school-select").value;
      drawFutureFlowchart(selected); // Redraw the flowchart
      highlightFuturePath(selected); // Highlight the updated path
      updateFutureSummary(); // Update the summary table
      populateSchoolSummaryTable(schools);
      });


      document.getElementById("systems-slider").addEventListener("input", e => {
  const percentValue = parseInt(e.target.value, 10); 
  thresholds.systemsDeficient = parseInt(e.target.value, 10);
  document.getElementById("systems-out").textContent = `${percentValue} systems`;

  const selected = document.getElementById("school-select").value;
  drawFutureFlowchart(selected); // Redraw the flowchart
  highlightFuturePath(selected); // Highlight the updated path
  updateFutureSummary(); // Update the summary table
  populateSchoolSummaryTable(schools);
});
    function rehighlightSelectedSchool() {
      const selected = document.getElementById("school-select").value;
      if (selected) {
         drawFutureFlowchart(selected); // Redraw the flowchart
  highlightFuturePath(selected); // Highlight the updated path
  updateFutureSummary(); // Update the summary table
  populateSchoolSummaryTable(schools);
      }
    }

function showSchoolInfo(schoolName) {
  const school = schools.find(s => s.name === schoolName);
  if (!school) {
    document.getElementById("school-info").style.display = "none";
    document.getElementById("not-applicable-message").style.display = "none";
    return;
  }

    document.getElementById("school-name").textContent = school.name || "-";
    document.getElementById("state-rated-capacity").textContent = school.stateRatedCapacity || "-";
   document.getElementById("funding-factor").textContent = school.fundingFactor || "-";
  // ✅ Convert number to label safely
  document.getElementById("campus-score").textContent =
    typeof school.campusScore === "number"
      ? campusScoreLabels[school.campusScore] || "-"
      : school.campusScore || "-";


      
   document.getElementById("ea-score").textContent =
  eaLabels.includes(school.eaValue?.trim())
    ? school.eaValue.trim()
    : "N/A";

  document.getElementById("building-age").textContent = school.modifiedAge || "-";
  document.getElementById("school-info-band").style.display = "block";
 


  // Show/hide not-applicable message
  if (school.utilization < 100) {
    document.getElementById("not-applicable-message").style.display = "";
  } else {
    document.getElementById("not-applicable-message").style.display = "none";
  }
}

function updateSummary() {
  const summary = { Addition: 0, Redistrict: 0, Portables: 0, NA: 0 };
  schools.filter(filterByGrade).forEach(school => {
    const outcome = determineOutcome(school);
    console.log("Funding check:", school.fundingFactor, thresholds.fundingFactor);
    if (outcome in summary) summary[outcome]++;
    else summary.NA++;
  });
  const tbody = document.getElementById("summary-body");
  tbody.innerHTML = `
    <tr class="addition-row"><td>Addition</td><td>${summary.Addition}</td></tr>
    <tr class="redistrict-row"><td>Redistrict</td><td>${summary.Redistrict}</td></tr>
    <tr class="portables-row"><td>Portables</td><td>${summary.Portables}</td></tr>
    <tr class="na-row"><td>Not Applicable</td><td>${summary.NA}</td></tr>
  `;
  document.getElementById("summary-total").textContent =
    summary.Addition + summary.Redistrict + summary.Portables + summary.NA;
}

// Outcome Logic Flowchart 1
function determineOutcome(school) {
  if (!school.utilization || school.utilization < 100) return "NA";
  if (school.utilization < thresholds.utilization) return "Portables";
  return school.fundingFactor >= thresholds.fundingFactor ? "Redistrict" : "Addition";
}


function populateSchoolSummaryTable(schools) {
  const tbody = document.getElementById('school-summary-table-body');
  tbody.innerHTML = '';

  schools.filter(filterByGrade).forEach(school => {
    const row = document.createElement('tr');
    const schoolLevel = school.schoolType || getSchoolType(school.gradesServed);
    const renovationDecision = determineFutureOutcome(school);

    row.innerHTML = `
      <td style="padding: 0.5rem;">${school.name}</td>
      <td style="padding: 0.5rem;">${school.gradesServed}</td>
      <td style="padding: 0.5rem;">${renovationDecision}</td>
    `;
    tbody.appendChild(row);
  });
}



// FLOWCHART 1: Addition Evaluation
function initializeFlowchart() {
  const svg = d3.select("#flowchart-svg");
  svg.selectAll("*").remove(); // Clear existing elements
  const g = svg.append("g");
  drawFlowchart(g); // Draw the flowchart
  updateFlowchart(); // Highlight paths based on selected school
}

function drawFlowchart(g) {
  // Use current slider values in node labels
  const nodes = [
  { id: "util", label: `Utilization ≥ ${thresholds.utilization}%`, x: 10, y: 120, w: 200, h: 60 },
  { id: "funding", label: `Funding Factor ≥ ${thresholds.fundingFactor}`, x: 350, y: 120, w: 220, h: 60 },
  { id: "addition", label: "Addition", x: 710, y: 40, w: 120, h: 60, type: "outcome" },
  { id: "redistrict", label: "Redistrict", x: 710, y: 120, w: 120, h: 60, type: "outcome" },
  { id: "portables", label: "Portables", x: 710, y: 200, w: 120, h: 60, type: "outcome" }
];

  const links = [
  { from: "util", to: "funding", type: "yes" },        // utilization >= threshold
  { from: "util", to: "portables", type: "no" },       // 100 <= u < threshold
  { from: "funding", to: "redistrict", type: "yes" },
  { from: "funding", to: "addition", type: "no" }
];

  // Draw links (elbow connectors)
  g.selectAll(".link")
    .data(links)
    .enter()
    .append("polyline")
    .attr("class", "link inactive")
    .attr("fill", "none")
    .attr("stroke", d => d.type === "yes" ? "#34a853" : "#ea4335")
    .attr("stroke-width", 2.5)
    .attr("marker-end", "url(#arrow-grey)") // <-- always grey by default
    .attr("points", d => {
      const from = nodes.find(n => n.id === d.from);
      const to = nodes.find(n => n.id === d.to);

      // Horizontal elbow: right, then down/up
      if (d.from === "util" && d.to === "funding") {
        // Yes path: right, then right
        return [
          [from.x + from.w, from.y + from.h / 2],
          [to.x, to.y + to.h / 2]
        ].map(p => p.join(",")).join(" ");
      }
      if (d.from === "funding" && d.to === "size") {
        return [
          [from.x + from.w, from.y + from.h / 2],
          [to.x, to.y + to.h / 2]
        ].map(p => p.join(",")).join(" ");
      }
      if (d.from === "size" && d.to === "addition") {
        // Start at right middle of "size"
        const startX = from.x + from.w;
        const startY = from.y + from.h / 2;
        const elbowY = to.y + to.h / 2;
       
        const endX = to.x;
        return [
          [startX, startY],
          [startX, elbowY],
          [endX, elbowY]   
        ].map(p => p.join(",")).join(" ");
      }

      // Redistrict: elbow down, then right
      if (d.from === "size" && d.to === "redistrict") {
        return [
          [from.x + from.w, from.y + from.h / 2],
          [from.x + from.w + 40, from.y + from.h / 2],
          [from.x + from.w + 40, to.y + to.h / 2],
          [to.x, to.y + to.h / 2]
        ].map(p => p.join(",")).join(" ");
      }
      if (d.from === "funding" && d.to === "portables") {
        return [
          [from.x + from.w / 2, from.y + from.h],
          [from.x + from.w / 2, to.y + to.h / 2],
          [to.x, to.y + to.h / 2]
        ].map(p => p.join(",")).join(" ");
      }
      if (d.from === "util" && d.to === "portables") {
        return [
          [from.x + from.w / 2, from.y + from.h],
          [from.x + from.w / 2, to.y + to.h / 2],
          [to.x, to.y + to.h / 2]
        ].map(p => p.join(",")).join(" ");
      }
      // Default: straight line
      return [
        [from.x + from.w, from.y + from.h / 2],
        [to.x, to.y + to.h / 2]
      ].map(p => p.join(",")).join(" ");
    });

  // Arrow marker (add this if not already present)
  g.append("defs").html(`
      <marker id="arrow" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,-5L10,0L0,5" fill="#ea4335"/>
    </marker>
    <marker id="arrow-green" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,-5L10,0L0,5" fill="#34a853"/>
    </marker>
    <marker id="arrow-grey" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,-5L10,0L0,5" fill="#bbb"/>
    </marker>
  `);

  // Draw nodes
  const nodeGroups = g.selectAll(".node")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", d => "node inactive" + (d.type === "outcome" ? " outcome" : ""))
    .attr("id", d => "node-" + d.id)
    .attr("transform", d => `translate(${d.x},${d.y})`);

  nodeGroups.append("rect")
    .attr("width", d => d.w)
    .attr("height", d => d.h)
    .attr("rx", 15)
    .attr("ry", 15);

  nodeGroups.append("text")
  .attr("text-anchor", "middle")
  .attr("transform", d => `translate(${d.w / 2}, ${d.h / 2})`)
  .attr("font-size", 16)
  .attr("font-family", "Franklin Gothic Book, Arial, sans-serif")
  .each(function(d) {
    const lines = d.label.split("\n");
    const text = d3.select(this);
    lines.forEach((line, i) => {
      text.append("tspan")
        .attr("x", 0)
        .attr("dy", i === 0 
          ? `${-(lines.length - 1) * 0.6}em` // shift up to center group
          : "1.2em")                         // normal spacing
        .text(line);
    });
  });
}



function updateFlowchart() {
  const svg = d3.select("#flowchart-svg");
  svg.selectAll("*").remove(); // Clear existing elements
  const g = svg.append("g");
  drawFlowchart(g); // Redraw the flowchart
  const schoolName = document.getElementById("school-select").value;
  highlightPath(schoolName); // Highlight the path for the selected school
}

function highlightPath(schoolName) {
  // Remove all highlights and set all to inactive
  d3.select("#flowchart-svg").selectAll(".node")
    .classed("active", false)
    .classed("inactive", true);
  d3.select("#flowchart-svg").selectAll(".link")
    .classed("active-yes", false)
    .classed("active-no", false)
    .classed("inactive", true);

  if (!schoolName) return;
  const school = schools.find(s => s.name === schoolName);
  if (!school) return;
  const outcome = determineOutcome(school);
  

  // Define the path for each outcome for Workflow 1
if (outcome === "Addition") {
  pathNodes = ["util", "funding", "addition"];
  pathLinks = [
    { from: "util", to: "funding" },
    { from: "funding", to: "addition" }
  ];
} else if (outcome === "Redistrict") {
  pathNodes = ["util", "funding", "redistrict"];
  pathLinks = [
    { from: "util", to: "funding" },
    { from: "funding", to: "redistrict" }
  ];
} else if (outcome === "Portables") {
  pathNodes = ["util", "portables"];
  pathLinks = [{ from: "util", to: "portables" }];
} else {
  pathNodes = [];
  pathLinks = [];
}


  // Highlight only the path nodes and links
  pathNodes.forEach(id => {
    d3.select(`#node-${id}`).classed("inactive", false).classed("active", true);
  });
  pathLinks.forEach(link => {
    d3.select("#flowchart-svg")
      .selectAll(".link")
      .filter(function(d) {
        return d && d.from === link.from && d.to === link.to;
      })
      .classed("inactive", false)
      .classed("active-yes", true)
      .attr("marker-end", () => {
        if (link.type === "yes") return "url(#arrow-green)";
        if (link.type === "no" || link.type === "fail") return "url(#arrow)";
        return "url(#arrow-grey)";
      });
      });

  // Set all other links back to grey marker
  d3.select("#flowchart-svg")
    .selectAll(".link.inactive")
    .attr("marker-end", "url(#arrow-grey)");
}

// FLOWCHART 2: Renovation or Replacement (Future Flow)
  // Links: {from, to, type}
  const links = [
    { from: "campus", to: "edAdeq", type: "yes" },
    { from: "edAdeq", to: "funding", type: "yes" },
    { from: "funding", to: "modAge", type: "yes" },
    { from: "modAge", to: "historic", type: "yes" },
    { from: "historic", to: "upgrade", type: "yes" },
    { from: "historic", to: "keep", type: "no" },
    { from: "modAge2", to: "minorSystems", type: "yes" },
    { from: "modAge2", to: "noMajor", type: "no" },
    { from: "systems", to: "MinorSystemic", type: "no" },
    { from: "systems", to: "renovation", type: "yes" },
    { from: "minorSystems", to: "noMajor", type: "no" },
    { from: "minorSystems", to: "systems", type: "yes" },
    
    // Red lines (failures)
    { from: "campus", to: "modAge2", type: "fail" },
    { from: "edAdeq", to: "modAge2", type: "fail" },
    { from: "funding", to: "modAge2", type: "fail" },
    { from: "modAge", to: "modAge2", type: "fail" },
  
  ];


function drawFutureFlowchart(selectedSchoolName = "") {
  const svg = d3.select("#future-flowchart-svg");
  svg.selectAll("*").remove();
  const g = svg.append("g");


  // Node definitions (positions and labels based on your image)
  const nodes = [
    { 
  id: "campus", label: `${useCampusScoreToday ? "FY24-25" : "FY34-35"} Building\nis ${campusScoreLabels[thresholds.campusScore]}`, x: 10, y: 120, w: 200, h: 70 },
    { id: "edAdeq", label: `Space Constraints: \n ${eaLabels[thresholds.eaIndex]}  \nor worse`, x: 260, y: 120, w: 200, h: 70 },
    { id: "funding", label: `Functional Fit ≥ ${thresholds.renovationFundingFactor.toFixed(1)}`, x: 510, y: 120, w: 200, h: 70 },
    { id: "modAge", label: `Modified Age\n≥ ${thresholds.modifiedAge}`, x: 760, y: 120, w: 200, h: 70 },
    { id: "historic", label: "Historic Building", x: 1010, y: 120, w: 200, h: 70 },
    { id: "keep", label: "keep", x: 1240, y: 10, w: 200, h: 80 },
    { id: "upgrade", label: "upgrade", x: 1240, y: 115, w: 200, h: 80 },
    { id: "modAge2", label: `Modified Age\n≥ ${thresholds.modifiedAge2}`, x: 1010, y: 250, w: 200, h: 70 },
    { id: "systems", label: `${thresholds.systemsDeficient} or more systems\nfair or deficient`, x: 1010, y: 480, w: 200, h: 70 },
    { id: "minorSystems", label: `${thresholds.minorSystemsDeficient} or more systems\nfair or deficient`, x: 1010, y: 370, w: 200, h: 70 },
    { id: "noMajor", label: "Relocate", x: 1240, y: 245, w: 200, h: 80 },
    { id: "MinorSystemic", label: "Sell", x: 1240, y: 370, w: 200, h: 80 },
    { id: "renovation", label: "Repurpose", x: 1240, y: 480, w: 200, h: 80 }
  ];


  
  // Helper to get node by id
  const getNode = id => nodes.find(n => n.id === id);


  // Inside drawFutureFlowchart()
links.forEach(link => {
  const s = getNode(link.from);
  const t = getNode(link.to);
  const color = "#bbb"; // Default color for inactive links
  const marker = "url(#arrow-grey)";


    // 1. Historic → modAge2: straight down
    if (link.from === "historic" && link.to === "modAge2") {
      g.append("line")
      .datum(link)
      .attr("class", "link inactive")
      .attr("x1", s.x + s.w / 2)
      .attr("y1", s.y + s.h)
      .attr("x2", t.x + t.w / 2)
      .attr("y2", t.y)
      .attr("stroke", color)
      .attr("stroke-width", 2.5)
      .attr("fill", "none")
      .attr("marker-end", marker);

    }
    // 2. modAge2 → systems: straight down
else if (link.from === "modAge2" && link.to === "minorSystems") {
  g.append("line")
    .datum(link)
    .attr("class", "link inactive")
    .attr("x1", s.x + s.w / 2)
    .attr("y1", s.y + s.h)
    .attr("x2", t.x + t.w / 2)
    .attr("y2", t.y)
    .attr("stroke", color)
    .attr("stroke-width", 2.5)
    .attr("fill", "none")
    .attr("marker-end", marker);
}

    // 2.1 modAge2 → systems: straight down
    else if (link.from === "minorSystems" && link.to === "systems") {
      g.append("line")
      .datum(link)
      .attr("class", "link inactive")
        .attr("x1", s.x + s.w / 2)
        .attr("y1", s.y + s.h)
        .attr("x2", t.x + t.w / 2)
        .attr("y2", t.y)
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("fill", "none")
        .attr("marker-end", marker);
    }

    // 3. Elbow for campus/edAdeq/funding/modAge → modAge2
    else if (["campus", "edAdeq", "funding", "modAge"].includes(link.from) && link.to === "modAge2") {
      const startX = s.x + s.w / 2;
      const startY = s.y + s.h;
      const elbowY = t.y + t.h / 2;
      const elbowX = t.x - 40;
      g.append("polyline")
      .datum(link)
      .attr("class", "link inactive")
        .attr("points", [
          [startX, startY],
          [startX, elbowY],
          [elbowX, elbowY],
          [t.x, elbowY]
        ].map(p => p.join(",")).join(" "))
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("fill", "none")
        .attr("marker-end", marker);
    }
 
    // 5. systems → renovation: elbow down then right
    else if (link.from === "systems" && link.to === "renovation") {
      g.append("polyline")
      .datum(link)
      .attr("class", "link inactive")
        .attr("points", [
          [s.x + s.w / 2, s.y + s.h],                // bottom center of systems
          [s.x + s.w / 2, t.y + t.h / 2],            // straight down to align with renovation
          [t.x, t.y + t.h / 2]                       // right into renovation
        ].map(p => p.join(",")).join(" "))
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("fill", "none")
        .attr("marker-end", marker);
    }
    // 6. modAge2 → noMajor: to the right
        else if (link.from === "modAge2" && link.to === "noMajor") {
      g.append("line")
        .datum(link)
        .attr("class", "link inactive")
        .attr("x1", s.x + s.w)
        .attr("y1", s.y + s.h / 2)
        .attr("x2", t.x)
        .attr("y2", t.y + t.h / 2)
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("fill", "none")
        .attr("marker-end", marker);
    }

    // 7. historic → keep: elbow up then right
    else if (link.from === "historic" && link.to === "keep") {
      g.append("polyline")
      .datum(link)
      .attr("class", "link inactive")
        .attr("points", [
          [s.x + s.w / 2, s.y],                      // top center of historic
          [s.x + s.w / 2, t.y + t.h / 2],            // straight up to align with keep
          [t.x, t.y + t.h / 2]                       // right into keep
        ].map(p => p.join(",")).join(" "))
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("fill", "none")
        .attr("marker-end", marker);
    }


    
    // 8. Default: straight horizontal
    else {
      g.append("line")
      .datum(link)
      .attr("class", "link inactive")
        .attr("x1", s.x + s.w)
        .attr("y1", s.y + s.h/2)
        .attr("x2", t.x)
        .attr("y2", t.y + t.h/2)
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("marker-end", marker);
    }
  });

  // Arrow marker
  svg.append("defs").html(`
    <marker id="arrow" viewBox="0 -5 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,-5L10,0L0,5" fill="#ea4335"/>
    </marker>
    <marker id="arrow-green" viewBox="0 -5 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,-5L10,0L0,5" fill="#34a853"/>
    </marker>
    <marker id="arrow-grey" viewBox="0 -5 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto">
    <path d="M0,-5L10,0L0,5" fill="#bbb"/>
    </marker>

  `);

  // Draw nodes
  const nodeGroups = g.selectAll(".node")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "node inactive")
    .attr("id", d => `future-node-${d.id}`)
    .attr("transform", d => `translate(${d.x},${d.y})`);

    

  nodeGroups.append("rect")
    .attr("width", d => d.w)
    .attr("height", d => d.h)
    .attr("rx", 15)
    .attr("ry", 15)
    .attr("fill", "#fff")
    .attr("stroke", "#222")
    .attr("stroke-width", 2);

  nodeGroups.append("text")
    .attr("x", d => d.w / 2)
    .attr("y", d => d.h / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 18)
    .attr("font-family", "Franklin Gothic Book, Arial, sans-serif")
    .each(function(d) {
      const lines = d.label.split("\n");
      const text = d3.select(this);
      lines.forEach((line, i) => {
        const lineHeight = 20;
        const yOffset = (i - (lines.length - 1) / 2) * lineHeight;
        text.append("tspan")
          .attr("x", d.w / 2)
          .attr("y", d.h / 2 + yOffset)
          .text(line);
      });
    });

if (selectedSchoolName) {
  highlightFuturePath(selectedSchoolName);
}
}



function highlightFuturePath(schoolName) {
  console.log("Highlighting path for:", schoolName);
  const svg = d3.select("#future-flowchart-svg");

  // Reset all nodes and links to inactive
  svg.selectAll(".node")
    .classed("active", false)
    .classed("inactive", true);

  svg.selectAll(".link")
    .classed("active-yes", false)
    .classed("active-no", false)
    .classed("inactive", true)
    .attr("marker-end", "url(#arrow-grey)");

  if (!schoolName) return;

  const school = schools.find(s => s.name === schoolName);
  if (!school) return;

  let pathNodes = [], pathLinks = [];

  // Start with the first node
  pathNodes.push("campus");

pathLinks.forEach(link => {
  const fullLink = links.find(l => l.from === link.from && l.to === link.to);
  const type = link.type || fullLink?.type || "yes"; 
  const marker = type === "no" || type === "fail" ? "url(#arrow)" : "url(#arrow-green)";
  const className = type === "no" || type === "fail" ? "active-no" : "active-yes";

  d3.select("#flowchart-svg")
    .selectAll(".link")
    .filter(d => d && d.from === link.from && d.to === link.to)
    .classed("inactive", false)
    .classed("active-yes", false)
    .classed("active-no", false)
    .classed(className, true)
    .attr("marker-end", marker);
});

  const scoreValue = useCampusScoreToday ? school.campusScoreToday : school.campusScore; if (scoreValue <= thresholds.campusScore) {
    pathNodes.push("edAdeq");
    pathLinks.push({ from: "campus", to: "edAdeq" });

    // Educational Adequacy check
    const eaLabels = ["N/A", "", "Significantly Constrained", "Constrained", "No Constraints"];
    const eaValueIndex = eaLabels.indexOf(school.eaValue?.trim() || "N/A");

    if (eaValueIndex >= 0 && eaValueIndex <= thresholds.eaIndex) {
      pathNodes.push("funding");
      pathLinks.push({ from: "edAdeq", to: "funding" });

      // Funding Factor check
      if (school.fundingFactor > thresholds.renovationFundingFactor) {
        pathNodes.push("modAge");
        pathLinks.push({ from: "funding", to: "modAge" });

        // Modified Age check
        if (school.modifiedAge > thresholds.modifiedAge) {
  pathNodes.push("modAge");
  pathLinks.push({ from: "funding", to: "modAge" });

  if (school.historicBuilding) {
    pathNodes.push("historic");
    pathLinks.push({ from: "modAge", to: "historic" });

    pathNodes.push("upgrade");
    pathLinks.push({ from: "historic", to: "upgrade" });
  } else {
    pathNodes.push("renewal");
    pathLinks.push({ from: "modAge", to: "renewal" });
  }
}
 else {
          pathNodes.push("modAge2");
          pathLinks.push({ from: "modAge", to: "modAge2" });
        }
      } else {
        pathNodes.push("modAge2");
        pathLinks.push({ from: "funding", to: "modAge2" });
      }
    } else {
      pathNodes.push("modAge2");
      pathLinks.push({ from: "edAdeq", to: "modAge2" });
    }
  } else {
    pathNodes.push("modAge2");
    pathLinks.push({ from: "campus", to: "modAge2" });
  }

  // Systems Deficiency check
    if (pathNodes.includes("modAge2")) {
      // If the building is young, skip systems and go directly to "No Major Project"
      if (school.modifiedAge <= thresholds.modifiedAge2) {
  pathNodes.push("noMajor");
  pathLinks.push({ from: "modAge2", to: "noMajor" });
} else {
  pathNodes.push("minorSystems");
  pathLinks.push({ from: "modAge2", to: "minorSystems" });

  const count = school.fairOrDeficientCount;

  if (count < 1) {
    // Skip systems completely
    pathNodes.push("noMajor");
    pathLinks.push({ from: "minorSystems", to: "noMajor" });
  } else {
    pathNodes.push("systems");
    pathLinks.push({ from: "minorSystems", to: "systems" });

    if (count >= thresholds.systemsDeficient) {
      pathNodes.push("renovation");
      pathLinks.push({ from: "systems", to: "renovation" });
    } else {
      pathNodes.push("MinorSystemic");
      pathLinks.push({ from: "systems", to: "MinorSystemic" });
    }
  }
}
    }


  // Highlight the nodes and links
  pathNodes.forEach((id) => {
    d3.select(`#future-node-${id}`)
      .classed("inactive", false)
      .classed("active", true);
  });

      pathLinks.forEach((link) => {
      const fullLink = links.find(l => l.from === link.from && l.to === link.to);
      const type = link.type || fullLink?.type || "yes";
      const className = (type === "no" || type === "fail") ? "active-no" : "active-yes";
      const marker = (type === "no" || type === "fail") ? "url(#arrow)" : "url(#arrow-green)";

      svg.selectAll(".link")
        .filter(d => d && d.from === link.from && d.to === link.to)
        .classed("inactive", false)
        .classed("active-yes", false)
        .classed("active-no", false)
        .classed(className, true)
        .attr("marker-end", marker);
    });


  // Ensure all other links fade to grey
  svg.selectAll(".link.inactive")
    .attr("marker-end", "url(#arrow-grey)");
}

console.log("typeof determineOutcome:", typeof determineOutcome);
console.log("typeof determineFutureOutcome:", typeof determineFutureOutcome);

// Future summary
function determineFutureOutcome(school) {
  const campusScoreLabels = ["N/A", "", "Significantly Constrained", "Constrained", "No Constraints"];
  const rawScore = useCampusScoreToday ? school.campusScoreToday : school.campusScore;
  const campusIndex = typeof rawScore === "number"
  ? rawScore
  : campusScoreLabels.indexOf((rawScore || "N/A").trim());
  const passesCampus = campusIndex >= 0 && campusIndex <= thresholds.campusScore;

  const eaLabels = ["N/A", "", "Significantly Constrained", "Constrained", "No Constraints"];
  const eaValueIndex = eaLabels.indexOf((school.eaValue || "N/A").trim());
  const passesEA = eaValueIndex === 0 || (eaValueIndex > 0 && eaValueIndex <= thresholds.eaIndex);

  const passesFunding = school.fundingFactor > thresholds.renovationFundingFactor;
  const passesAge = school.modifiedAge > thresholds.modifiedAge;

  console.log(`[${school.name}]`);
  console.log(" - campusIndex:", campusIndex, "threshold:", thresholds.campusScore);
  console.log(" - eaValueIndex:", eaValueIndex, "threshold:", thresholds.eaIndex);
  console.log(" - fundingFactor:", school.fundingFactor, "threshold:", thresholds.renovationFundingFactor);
  console.log(" - modifiedAge:", school.modifiedAge, "threshold:", thresholds.modifiedAge);

  if (passesCampus && passesEA && passesFunding && passesAge) {
    return school.historicBuilding ? "upgrade" : "keep";
  }

  if (school.modifiedAge <= thresholds.modifiedAge2) {
    return "Relocate";
  }

  const count = school.fairOrDeficientCount;
  if (count < 1) {
    return "Relocate";
  }

  if (count >= thresholds.systemsDeficient) {
    return "Repurpose";
  }

  return "Sell";
}

// Summary additions
function updateFutureSummary() {
  const futureSummary = {
    keep: 0,
    upgrade: 0,
    "Relocate": 0,
    "Sell": 0,
    "Repurpose": 0,
    Renovation: 0,
    NA: 0
  };

  schools.filter(filterByGrade).forEach(school => {
    const outcome = determineFutureOutcome(school);
    console.log("School:", school.name, "Outcome:", outcome);
    if (outcome in futureSummary) futureSummary[outcome]++;
    else futureSummary.NA++;
  });

  const tbody = document.getElementById("future-summary-body");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr><td>keep</td><td>${futureSummary.keep}</td></tr>
    <tr><td>upgrade</td><td>${futureSummary.upgrade}</td></tr>
    <tr><td>Repurpose</td><td>${futureSummary["Repurpose"]}</td></tr>
    <tr><td>Sell</td><td>${futureSummary["Sell"]}</td></tr>
    <tr><td>Relocate</td><td>${futureSummary["Relocate"]}</td></tr>
  `;

  const totalElement = document.getElementById("future-summary-total");
  if (!totalElement) return;

  totalElement.textContent =
    futureSummary.keep +
    futureSummary.upgrade +
    futureSummary["Relocate"] +
    futureSummary["Repurpose"] +
    futureSummary["Sell"] +
    futureSummary.NA;
}
