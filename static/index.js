const socket = io();
let archiving = false;
let monitoring = false;

const labels = [];
const distanceData = [];
const lightData = [];

const chart = new Chart(
  document.getElementById("sensor-chart").getContext("2d"),
  {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Distance (cm)",
          data: distanceData,
          borderColor: "#2ce857",
          fill: false,
        },
        {
          label: "Light Level",
          data: lightData,
          borderColor: "#e8932c",
          fill: false,
        },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        x: { title: { display: true, text: "Time" } },
        y: { beginAtZero: true },
      },
    },
  }
);

let dist_opts = {
  angle: 0.1, // The span of the gauge arc
  lineWidth: 0.22, // The line thickness
  radiusScale: 1, // Relative radius
  pointer: {
    length: 0.6, // // Relative to gauge radius
    strokeWidth: 0.035, // The thickness
    color: "#ffffff", // Fill color
  },
  limitMax: false, // If false, max value increases automatically if value > maxValue
  limitMin: false, // If true, the min value of the gauge will be fixed
  colorStart: "#2ce857", // Colors
  // colorStop: "#2ce857", // just experiment with them
  strokeColor: "#0e4c1c", // to see which ones work best for you
  generateGradient: false,
  highDpiSupport: true, // High resolution support
  staticLabels: {
    font: "10pt sans-serif", // Specifies font
    labels: [0, 500], // Print labels at these values
    color: "#fff", // Optional: Label text color
    fractionDigits: 0, // Optional: Numerical precision. 0=round off.
  },
};
let dist_gauge = new Gauge(document.getElementById("dist-gauge")).setOptions(
  dist_opts
); // create sexy gauge!
dist_gauge.maxValue = 500; // set max gauge value
dist_gauge.setMinValue(0); // Prefer setter over gauge.minValue = 0

let light_opts = structuredClone(dist_opts);
light_opts["colorStart"] = "#e8932c";
// light_opts["colorStop"] = "#e8932c";
light_opts["strokeColor"] = "#4c300e";
light_opts["staticLabels"] = {
  font: "10pt sans-serif", // Specifies font
  labels: [0, 1024], // Print labels at these values
  color: "#fff", // Optional: Label text color
  fractionDigits: 0, // Optional: Numerical precision. 0=round off.
};
let light_gauge = new Gauge(document.getElementById("light-gauge")).setOptions(
  light_opts
); // create sexy gauge!
light_gauge.maxValue = 1024; // set max gauge value
light_gauge.setMinValue(0); // Prefer setter over gauge.minValue = 0

function update_table() {
  let target = document.getElementById("readings-table");
  target.innerHTML =
    "<tr><th>Timestamp</th><th>Distance (cm)</th><th>Light level</th></tr>";

  for (let i = 0; i < labels.length; i++) {
    target.innerHTML += `<tr><td>${labels[i]}</td><td>${distanceData[i]}</td><td>${lightData[i]}</td></tr>`;
  }
}

socket.on("sensor_data", (data) => {
  if (!monitoring) return;
  const now = new Date().toLocaleTimeString();
  labels.push(now);
  distanceData.push(data.distance);
  lightData.push(data.light);

  if (labels.length > 20) {
    labels.shift();
    distanceData.shift();
    lightData.shift();
  }
  chart.update();
  update_table();

  dist_gauge.set(data.distance);
  light_gauge.set(data.light);

  document.getElementById("sensor-dist").innerText = `${data.distance}cm`;
  document.getElementById("sensor-light").innerText = data.light;
});

function update_offsets() {
  let distance_offset = document.getElementById("dist-offset-input").value;
  let light_offset = document.getElementById("light-offset-input").value;
  socket.emit("update_offsets", { distance_offset, light_offset });
}

document
  .getElementById("dist-offset-input")
  .addEventListener("change", update_offsets);
document
  .getElementById("light-offset-input")
  .addEventListener("change", update_offsets);

document.getElementById("archive-btn").addEventListener("click", () => {
  socket.emit("toggle_recording");
});

socket.on("recording_state", (data) => {
  archiving = data.recording;
  document.getElementById("archive-btn").innerText = archiving
    ? "Stop Recording"
    : "Start Recording";
  document.getElementById("monitor-btn").disabled = archiving;
  document.getElementById("dist-offset-input").disabled = archiving;
  document.getElementById("light-offset-input").disabled = archiving;

  document.getElementById("recording-indicator").hidden = !archiving;
});

document.getElementById("monitor-btn").addEventListener("click", () => {
  monitoring = !monitoring;
  document.getElementById("monitor-btn").innerText = monitoring
    ? "Disconnect"
    : "Connect";
  document.getElementById("archive-btn").disabled = !monitoring;

  if (monitoring) {
    labels.splice(0, labels.length);
    distanceData.splice(0, distanceData.length);
    lightData.splice(0, lightData.length);
    update_table();
  }
});

update_offsets();
