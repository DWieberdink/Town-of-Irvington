// File: script.js
let totalSQF = 0;
let utilizationChart;
let costChart; 

  // --- Map Setup ---
  mapboxgl.accessToken = 'pk.eyJ1IjoicGF0d2QwNSIsImEiOiJjbTZ2bGVhajIwMTlvMnFwc2owa3BxZHRoIn0.moDNfqMUolnHphdwsIF87w';

let lastView = {
  center: [-73.867, 41.0391],
  zoom: 14,
  bearing: 0,
  pitch: 0
};

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: lastView.center,
  zoom: lastView.zoom,
  bearing: lastView.bearing,
  pitch: lastView.pitch
});

map.on('moveend', () => {
  lastView = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch()
  };
});

  const draw = new MapboxDraw({
  displayControlsDefault: false,
  controls: { polygon: true, trash: true },
  defaultMode: 'draw_polygon',
  styles: [
    // Inactive fill (with full opacity)
    {
      id: 'gl-draw-polygon-fill-inactive',
      type: 'fill',
      filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
      paint: {
        'fill-color': '#D1FAE5',
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.8]
      }
    },
    // Active fill (editing)
    {
      id: 'gl-draw-polygon-fill-active',
      type: 'fill',
      filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'draw_polygon']],
      paint: {
        'fill-color': '#34D399',
        'fill-opacity': 0.6
      }
    },
    // Stroke
    {
      id: 'gl-draw-polygon-stroke-active',
      type: 'line',
      filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'draw_polygon']],
      paint: {
        'line-color': '#059669',
        'line-width': 2
      }
    },
    // Vertices (edit handles)
    {
      id: 'gl-draw-polygon-midpoint',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
      paint: {
        'circle-radius': 5,
        'circle-color': '#34D399'
      }
    },
    {
      id: 'gl-draw-polygon-vertex-active',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
      paint: {
        'circle-radius': 6,
        'circle-color': '#059669'
      }
    }
  ]
});


map.addControl(draw);

document.getElementById('mapStyle').addEventListener('change', function () {
  const styleId = this.value;
  map.setStyle(`mapbox://styles/${styleId}`);

    loadGeoJson();
    loadBuildings(); // now works!

  map.once('style.load', () => {
    map.jumpTo({
  center: lastView.center,
  zoom: lastView.zoom,
  bearing: lastView.bearing,
  pitch: lastView.pitch
});

  });
});

let highlightVisible = true;
let buildingData = null;

map.on('load', () => {
  loadGeoJson();
  loadParcels();
  loadBuildings().then(data => {
    buildingData = data;
    populateDropdown(data);
    updateHighlights();
  });


  const container = document.createElement('div');
container.className = 'bg-white p-2 rounded shadow mt-2';


const targetColumn = document.getElementById('controlsColumn');
if (targetColumn) {
  targetColumn.appendChild(container);
}

// Building Selector (must come first so toggleDropdown can reference it)
const selector = document.createElement('select');
selector.id = 'buildingSelector';
selector.className = 'p-2 rounded shadow w-full hidden';
selector.multiple = true;
selector.size = 10;
selector.onchange = updateHighlights;
container.appendChild(selector);

// Toggle Highlight Button
const toggleButton = document.createElement('button');
toggleButton.textContent = 'Toggle Highlight';
toggleButton.className = 'bg-yellow-400 p-2 rounded shadow w-full mb-2';
toggleButton.onclick = () => {
  highlightVisible = !highlightVisible;
  updateHighlights();
};
container.appendChild(toggleButton);

// Toggle Parcels Button
const toggleParcels = document.createElement('button');
toggleParcels.textContent = 'Toggle Parcels';
toggleParcels.className = 'bg-gray-300 p-2 rounded shadow w-full mb-2';
let parcelsVisible = true;

toggleParcels.onclick = () => {
  parcelsVisible = !parcelsVisible;

  if (parcelsVisible) {
    loadParcels();
  } else {
    if (map.getLayer('irvington-townparcel-fill')) map.removeLayer('irvington-townparcel-fill');
    if (map.getSource('irvington-townparcel')) map.removeSource('irvington-townparcel');
  }
};
container.appendChild(toggleParcels);

// Toggle Boundary Button
const toggleBoundary = document.createElement('button');
toggleBoundary.textContent = 'Toggle Town Boundary';
toggleBoundary.className = 'bg-red-400 p-2 rounded shadow w-full mb-2';
let boundaryVisible = true;

toggleBoundary.onclick = () => {
  boundaryVisible = !boundaryVisible;

  if (boundaryVisible) {
    loadGeoJson();
  } else {
    if (map.getLayer('irvington-boundary-fill')) map.removeLayer('irvington-boundary-fill');
    if (map.getLayer('irvington-boundary-line')) map.removeLayer('irvington-boundary-line');
    if (map.getSource('irvington-boundary')) map.removeSource('irvington-boundary');
  }
};
container.appendChild(toggleBoundary);

// Type Filter Dropdown
const typeFilter = document.createElement('select');
typeFilter.id = 'typeFilter';
typeFilter.className = 'hidden';
typeFilter.onchange = () => {
  populateDropdown(buildingData);
  updateHighlights();
};
container.appendChild(typeFilter);

// Toggle Building Selector Dropdown
const toggleDropdown = document.createElement('button');
toggleDropdown.textContent = 'Select Buildings';
toggleDropdown.className = 'bg-gray-200 p-1 rounded w-full mb-2';
toggleDropdown.onclick = () => {
  selector.classList.toggle('hidden');
};
container.appendChild(toggleDropdown);



// Building Utilization Chart
// Building Utilization Chart
const utilizationWrapper = document.createElement('div');
utilizationWrapper.className = 'mt-6';

// 👇 Group Selector Dropdown
const groupSelector = document.createElement('select');
groupSelector.id = 'buildingGroup';
groupSelector.className = 'p-2 rounded shadow w-full mb-2';

['All Buildings', 'Fire Station'].forEach(label => {
  const option = document.createElement('option');
  option.value = label;
  option.text = label;
  groupSelector.appendChild(option);
});

utilizationWrapper.appendChild(groupSelector);

// 👇 Chart Title
const utilizationTitle = document.createElement('h2');
utilizationTitle.className = 'text-xl font-semibold mb-2';
utilizationTitle.textContent = 'Building Use';

utilizationWrapper.appendChild(utilizationTitle);

// 👇 Chart Canvas
const utilizationCanvas = document.createElement('canvas');
utilizationCanvas.id = 'building-utilization-chart';

utilizationWrapper.appendChild(utilizationCanvas);
container.appendChild(utilizationWrapper);


  // Building Cost Chart
  const costWrapper = document.createElement('div');
  costWrapper.className = 'mt-6';

  const costTitle = document.createElement('h2');
  costTitle.className = 'text-xl font-semibold mb-2';
  costTitle.textContent = 'Building Cost';

  const costCanvas = document.createElement('canvas');
  costCanvas.id = 'school-score-chart';

  costWrapper.appendChild(costTitle);
  costWrapper.appendChild(costCanvas);
  container.appendChild(costWrapper);

  // --- Charts ---

const utilizationCtx = document.getElementById('building-utilization-chart');
if (utilizationCtx) {
  Chart.register(window['chartjs-plugin-annotation']);

  const originalValues = {
    'Safety': 75000,
    'Operations': 50000,
    'Administration': 60000,
    'Support': 10000
  };

  const targetByType = {
    'Safety': 100000,
    'Operations': 60000,
    'Administration': 80000,
    'Support': 20000
  };

  const labels = Object.keys(originalValues);
  const annotations = {};

  Object.entries(targetByType).forEach(([label, value]) => {
    const index = labels.indexOf(label);
    if (index !== -1) {
      annotations[`target_${label}`] = {
        type: 'line',
        yMin: value,
        yMax: value,
        xMin: index - 0.4,
        xMax: index + 0.4,
        xScaleID: 'x',
        borderColor: '#EF4444',
        borderWidth: 2,
        borderDash: [6, 4],
        label: {
          enabled: true,
          content: `Target: ${value.toLocaleString()} SQF`,
          position: 'start',
          backgroundColor: 'rgba(239,68,68,0.1)',
          color: '#EF4444',
          font: { weight: 'bold' }
        }
      };
    }
  });

  utilizationChart = new Chart(utilizationCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Existing',
          data: Object.values(originalValues),
          backgroundColor: ['#4F46E5', '#3B82F6', '#10B981', '#FBBF24'],
          stack: 'total'
        },
        {
          label: 'New Building',
          data: [0, 0, 0, 0],
          backgroundColor: ['#A5B4FC', '#BFDBFE', '#6EE7B7', '#FDE68A'],
          stack: 'total'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.5,
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString();
            }
          }
        }
      },
      plugins: {
        annotation: {
          annotations: annotations
        },
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}



const scoreCtx = document.getElementById('school-score-chart');

if (scoreCtx) {
  costChart = new Chart(scoreCtx, {
    type: 'doughnut',
    data: {
      labels: ['Hard Cost', 'Soft Cost'],
      datasets: [{
        data: [0, 0],
        backgroundColor: ['#EF4444', '#F59E0B']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw;
              const formatted = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0
              }).format(value);
              return `${label}: ${formatted}`;
            }
          }
        },
        datalabels: {
          color: '#111',
          font: {
            weight: 'bold'
          },
          formatter: (value) => {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0
            }).format(value);
          }
        }
      }
    },
    plugins: [{
      id: 'centerText',
      beforeDraw(chart) {
        const { width, height } = chart;
        const ctx = chart.ctx;
        const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);

        ctx.save();
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#111';
        ctx.fillText(
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          }).format(total),
          width / 2,
          height / 2
        );
        ctx.restore();
      }
    }, ChartDataLabels]
  });
}





});

function updateHighlights() {
  if (!highlightVisible) {
    if (map.getLayer('highlighted-building')) map.removeLayer('highlighted-building');
    if (map.getSource('highlighted-building')) map.removeSource('highlighted-building');
    return;
  }

  const selectedOptions = document.getElementById('buildingSelector').selectedOptions;
  const selectedIds = Array.from(selectedOptions).map(option => parseInt(option.value));

  const source = map.getSource('irvington-townbuilding');
  if (!source) return;

  const data = source._data;
  const highlightFeature = {
    ...data,
    features: data.features.filter(f => selectedIds.includes(f.properties.OBJECTID))
  };

  if (map.getLayer('highlighted-building')) map.removeLayer('highlighted-building');
  if (map.getSource('highlighted-building')) map.removeSource('highlighted-building');

  map.addSource('highlighted-building', { type: 'geojson', data: highlightFeature });

map.addLayer({
  id: 'highlighted-building',
  type: 'line',
  source: 'highlighted-building',
  paint: {
    'line-color': '#F59E0B',
    'line-width': 2
  }
});

// Optional: show info
const highlightedFeature = highlightFeature.features[0];
const props = highlightedFeature?.properties;
if (props) {
  const area = props.SHAPEAREA || 0;
  const height = props.ACTUAL_HEI || 0;
  const floors = Math.max(1, Math.round(height / 10)); // assume 10ft per floor
  const adjustedSQF = Math.round(area * floors);

  const name = props.NAME || `Building ${props.OBJECTID}`;

new mapboxgl.Popup()
  .setLngLat(getCentroid(highlightedFeature))
  .setHTML(`
    <strong>Name:</strong> ${name}<br>
    <strong>Building ID:</strong> ${props.OBJECTID}<br>
    <strong>Height:</strong> ${height} ft<br>
    <strong>Floors:</strong> ${floors}<br>
    <strong>Est. SQF:</strong> ${adjustedSQF.toLocaleString()}
  `)
  .addTo(map);

}
}

function loadBuildings() {
  return fetch('irvington-townbuilding.geojson')
    .then(res => res.json())
    .then(data => {
      if (map.getSource('irvington-townbuilding')) map.removeSource('irvington-townbuilding');
      if (map.getLayer('irvington-townbuilding-fill')) map.removeLayer('irvington-townbuilding-fill');

      map.addSource('irvington-townbuilding', {
        type: 'geojson',
        data
      });

      map.addLayer({
        id: 'irvington-townbuilding-fill',
        type: 'fill',
        source: 'irvington-townbuilding',
        paint: {
          'fill-color': '#60A5FA',
          'fill-opacity': 0.8
        }
      });

      return data;
    })
    .catch(err => alert('Failed to load buildings GeoJSON: ' + err));
}

function loadParcels() {
  fetch('irvington-townparcel.geojson')
    .then(res => res.json())
    .then(data => {
      if (map.getSource('irvington-townparcel')) map.removeSource('irvington-townparcel');
      if (map.getLayer('irvington-townparcel-fill')) map.removeLayer('irvington-townparcel-fill');

      map.addSource('irvington-townparcel', {
        type: 'geojson',
        data
      });

      map.addLayer({
        id: 'irvington-townparcel-fill',
        type: 'fill',
        source: 'irvington-townparcel',
        layout: {},
        paint: {
          'fill-color': '#4d6921', 
          'fill-opacity': 0.4
        }
      });
    })
    .catch(err => alert('Failed to load parcels GeoJSON: ' + err));
}


function populateDropdown(data) {
  const selector = document.getElementById('buildingSelector');
  const typeFilter = document.getElementById('typeFilter');
  const selectedType = typeFilter.value?.toLowerCase(); // normalize case

  selector.innerHTML = '';
  const filtered = data.features.filter(f => {
    const desc = f.properties.DESCRIPTIO?.toLowerCase();
    return !selectedType || desc === selectedType;
  });

  const sorted = filtered.sort((a, b) => a.properties.OBJECTID - b.properties.OBJECTID);

  sorted.forEach(f => {
    const option = document.createElement('option');
    option.value = f.properties.OBJECTID;
    const name = f.properties.NAME || `Building ${f.properties.OBJECTID}`;
option.text = name;

    selector.appendChild(option);
  });
}



function loadGeoJson() {
  fetch('irvington-boundary-fixed.geojson')
    .then(res => res.json())
    .then(data => {
      if (map.getSource('irvington-boundary')) map.removeSource('irvington-boundary');
      if (map.getLayer('irvington-boundary-fill')) map.removeLayer('irvington-boundary-fill');
      if (map.getLayer('irvington-boundary-line')) map.removeLayer('irvington-boundary-line');

      map.addSource('irvington-boundary', { type: 'geojson', data });

      map.addLayer({
        id: 'irvington-boundary-fill',
        type: 'fill',
        source: 'irvington-boundary',
        paint: { 'fill-color': '#EF4444', 'fill-opacity': 0.1 }
      });

      map.addLayer({
        id: 'irvington-boundary-line',
        type: 'line',
        source: 'irvington-boundary',
        paint: { 'line-color': '#EF4444', 'line-width': 2 }
      });

      const bounds = turf.bbox(data);
      map.fitBounds(bounds, { padding: 20 });
    })
    .catch(err => alert('Failed to load boundary GeoJSON: ' + err));
}


  // --- Draw Handlers ---
  function getSelectedAttributes() {
    return {
      buildingType: document.getElementById('buildingType').value,
      stories: parseInt(document.getElementById('storyCount').value)
    };
  }

  map.on('draw.create', e => {
    const feature = e.features[0];
    const attrs = getSelectedAttributes();
    feature.properties = { ...feature.properties, ...attrs };
    console.log("Saved feature:", feature.properties); // 👈 Add this
    draw.delete(feature.id);
    draw.add(feature);
    updateDrawnFeatures();
    
  });

  map.on('draw.update', updateDrawnFeatures);
  map.on('draw.delete', updateDrawnFeatures);

function updateDrawnFeatures() {
  const data = draw.getAll();
  const tbody = document.getElementById('buildingsTableBody');
  tbody.innerHTML = '';

  let totalArea = 0;
  let totalStories = 0;

  // 👇 NEW: group area by building type
  const areaByType = {};

  data.features.forEach((feature, i) => {
    const area = turf.area(feature);
    const { buildingType = 'Unknown', stories = 1 } = feature.properties || {};
    const adjustedArea = area * stories;
    totalArea += adjustedArea;
    totalStories += stories;

    // 👇 tally per buildingType
    if (!areaByType[buildingType]) areaByType[buildingType] = 0;
    areaByType[buildingType] += adjustedArea;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="border p-2">${i + 1}</td>
      <td class="border p-2">${buildingType}</td>
      <td class="border p-2">${stories}</td>
      <td class="border p-2">${(adjustedArea * 10.7639).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>`;
    tbody.appendChild(row);
  });

  // update totals
  totalSQF = totalArea * 10.7639;
  document.getElementById('totalArea').textContent = totalSQF.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  document.getElementById('totalStories').textContent = totalStories;

  const totalCost = totalSQF * 1200;
  const hardCost = totalCost * 0.7;
  const softCost = totalCost * 0.3;

  if (costChart) {
    costChart.data.datasets[0].data = [hardCost, softCost];
    costChart.update();
  }

  // 👇 NEW: update utilization chart
 if (utilizationChart) {
  const areaByTypeSQF = {};
  for (const type in areaByType) {
    const sqf = areaByType[type] * 10.7639;
    areaByTypeSQF[type] = Math.round(sqf);
  }

  const existingLabels = utilizationChart.data.labels;

  // Update dataset[1] without changing labels or dataset[0]
  utilizationChart.data.datasets[1].data = existingLabels.map(type => {
    return areaByTypeSQF[type] || 0;
  });

  utilizationChart.update();
}



  console.log(`Total area: ${totalArea.toFixed(2)} m²`);
}



