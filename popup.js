// TODO: Move the calculation to background.js so that we don't need to store every website. 
// Make background.js store a cache of websites and whether they are a distraction so we don't constantly use resources to calculate.
// Figure out what we need to store in chrome.storage.sync for maximum functionality
// Properly calculate the time spent (parsing the Date objects)
import { focusTabUpdate } from './background.js';

function parseHoursMinsSecs(seconds) {
  let hrs = Math.floor(seconds / 3600);
  let mins = Math.floor((seconds % 3600) / 60);
  let secs = seconds % 60;

  return `${hrs} hours, ${mins} mins, ${secs} secs`;
}

document.addEventListener("DOMContentLoaded", async () => {
  chrome.storage.sync.get(async () => {
    // Update the recorded productive and distracted times
    await chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
      let activeTab = tabs[0]; // Get the first tab in the array (should be the current active tab)
      console.log("Active Tab URL:", activeTab.url);
      await focusTabUpdate(activeTab);
    });
    
    let cloud_storage_data = await chrome.storage.sync.get("trackingData");
    let cloud_data = cloud_storage_data.trackingData;
    
    console.log(cloud_data);
    
    // Calculate the total productive time
    const productiveElement = document.getElementById("time_productive");
    if (cloud_data.total_time_productive && cloud_data.total_time_productive[0] > 0) {
      productiveElement.innerHTML = '<i class="row">' + parseHoursMinsSecs(cloud_data.total_time_productive[0]) + '</i>';
    } else {
      productiveElement.innerHTML = '<i class="row">No time was spent being productive!</i>';
    }
  
    // Calculate the total distracted time
    const distractedElement = document.getElementById("time_distracted");
    if (cloud_data.total_time_distracted && cloud_data.total_time_distracted[0] > 0) {
      distractedElement.innerHTML = '<i class="row">' + parseHoursMinsSecs(cloud_data.total_time_distracted[0]) + '</i>';
    } else {
      distractedElement.innerHTML = '<i class="row">No time was spent being distracted!</i>';
    }
    
    const data = [ cloud_data.total_time_productive[0], cloud_data.total_time_distracted[0] ];
    console.log(data);
    const colors = ["#4682B4", "#FF6347"];
    drawPieChart(data, colors);
  });
});

function drawPieChart(data, colors) {
  const svgNS = "http://www.w3.org/2000/svg";
  const chart = document.getElementById('chart');
  chart.innerHTML = ''; // Clear previous chart
  const width = 300;
  const height = 300;
  const radius = Math.min(width, height) / 2;
  let total = data.reduce((sum, value) => sum + value, 0);
  let currentAngle = -0.5 * Math.PI;

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  chart.appendChild(svg);
  
  function createSingleColorCircle(color) {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", width / 2);
      circle.setAttribute("cy", height / 2);
      circle.setAttribute("r", radius);
      circle.setAttribute("fill", color); // Light grey color
      svg.appendChild(circle);
  }

  if (total === 0) {
      // Draw grey circle if total is 0
      createSingleColorCircle("#d3d3d3");
  } else {
      data.forEach((value, index) => {
          if (value === total) {
            createSingleColorCircle(colors[index]);
            return;
          }
          const sliceAngle = (value / total) * 2 * Math.PI;
          
          const x1 = width / 2 + radius * Math.cos(currentAngle);
          const y1 = height / 2 + radius * Math.sin(currentAngle);
          currentAngle += sliceAngle;
          const x2 = width / 2 + radius * Math.cos(currentAngle);
          const y2 = height / 2 + radius * Math.sin(currentAngle);
          const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

          const pathData = [
              `M ${width / 2} ${height / 2}`,
              `L ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
          ].join(' ');

          const path = document.createElementNS(svgNS, "path");
          path.setAttribute("d", pathData);
          path.setAttribute("fill", colors[index]);
          svg.appendChild(path);
      });
  }
}
