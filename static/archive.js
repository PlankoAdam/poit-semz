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

function update_table() {
  let target = document.getElementById("readings-table");
  target.innerHTML =
    "<thead><th>Timestamp</th><th>Distance (cm)</th><th>Light level</th></thead>";

  for (let i = 0; i < labels.length; i++) {
    target.innerHTML += `<tr><td>${labels[i]}</td><td>${distanceData[i]}</td><td>${lightData[i]}</td></tr>`;
  }
}

fetch("/api/sessions")
  .then((res) => res.json())
  .then((data) => {
    for (sesh of data) {
      let time = new Date(sesh.start_time).toLocaleString("en-GB");
      document.getElementById(
        "sessions-select"
      ).innerHTML += `<option value=${sesh.id}>${time}</option>`;
    }
  })
  .catch((err) => console.error(err));

document.getElementById("sessions-select").addEventListener("change", () => {
  let sesh_id = document.getElementById("sessions-select").value;
  if (!sesh_id) return;
  fetch(`/api/sessions/${sesh_id}`)
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      document.getElementById(
        "chart-title"
      ).innerText = `Archived Data from ${new Date(
        data.session.start_time
      ).toLocaleString("en-GB")}`;
      document.getElementById(
        "archive-dist-offset"
      ).innerText = `Distance offset: ${data.session.distance_offset}cm`;
      document.getElementById(
        "archive-light-offset"
      ).innerText = `Light level offset: ${data.session.light_offset}`;

      labels.splice(0, labels.length);
      distanceData.splice(0, distanceData.length);
      lightData.splice(0, lightData.length);
      for (datapoint of data.readings) {
        labels.push(new Date(datapoint.timestamp).toLocaleTimeString());
        distanceData.push(datapoint.distance_cm);
        lightData.push(datapoint.light_level);
      }
      chart.update();
      update_table();
    });
});
