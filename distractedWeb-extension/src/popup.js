// TODO: Move the calculation to background.js so that we don't need to store every website. 
// Make background.js store a cache of websites and whether they are a distraction so we don't constantly use resources to calculate.
// Figure out what we need to store in chrome.storage.sync for maximum functionality
// Properly calculate the time spent (parsing the Date objects)

function parseHoursMinsSecs(seconds) {
  let hrs = Math.floor(seconds / 3600);
  let mins = Math.floor((seconds % 3600) / 60);
  let secs = seconds % 60;

  return `${hrs} hours, ${mins} mins, ${secs} secs`;
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded");
  chrome.storage.sync.get(async () => {
    // Update the recorded productive and distracted times up to when the popup is opened
    // Might have to do this in the background.js file periodically. Doing it whenever the popup is opened 
    // causes a delay in the popup loading.
    // await chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
    //   let activeTab = tabs[0]; // Get the first tab in the array (should be the current active tab)
    //   console.log("Active Tab URL:", activeTab.url);
    //   chrome.runtime.sendMessage({ action: "focusTabUpdate", tab: activeTab }, (response) => {
    //     console.log(response.status);
    //   });
    // });

    console.log("Getting cloud storage data");

    // Fetch both storage objects in parallel, improving performance
    const [cloud_storage_data, local_storage_data] = await Promise.all([
      chrome.storage.sync.get("trackingData"),
      chrome.storage.local.get("trackingData")
    ]);

    let cloud_data = cloud_storage_data.trackingData;

    console.log(cloud_data);

    // Calculate percentage time productive/distracted.
    let totalTime = 0;
    totalTime += cloud_data.total_time_productive ? cloud_data.total_time_productive[0] : 0;
    totalTime += cloud_data.total_time_distracted ? cloud_data.total_time_distracted[0] : 0;

    // Display metrics for productive time
    const productiveElement = document.getElementById("time_productive");
    const percentProductiveElement = document.getElementById("percent_time_productive");
    if (cloud_data.total_time_productive && cloud_data.total_time_productive[0] > 0) {
      productiveElement.innerHTML = '<i class="row">' + parseHoursMinsSecs(cloud_data.total_time_productive[0]) + '</i>';
      percentProductiveElement.innerHTML = '<i class="row">' + Math.floor(cloud_data.total_time_productive[0] / totalTime * 100) + '% of your time</i>';
    } else {
      productiveElement.innerHTML = '<i class="row">No time was spent being productive!</i>';
    }

    // Display metrics for distracted time
    const distractedElement = document.getElementById("time_distracted");
    const percentDistractedElement = document.getElementById("percent_time_distracted");
    if (cloud_data.total_time_distracted && cloud_data.total_time_distracted[0] > 0) {
      distractedElement.innerHTML = '<i class="row">' + parseHoursMinsSecs(cloud_data.total_time_distracted[0]) + '</i>';
      percentDistractedElement.innerHTML = '<i class="row">' + Math.floor(cloud_data.total_time_distracted[0] / totalTime * 100) + '% of your time</i>';
    } else {
      distractedElement.innerHTML = '<i class="row">No time was spent being distracted!</i>';
    }

    // Draw Pie Chart
    const data = [cloud_data.total_time_productive[0], cloud_data.total_time_distracted[0]];
    console.log(data);
    const colors = ["#4682B4", "#FF6347"];
    drawPieChart(data, colors);

    // Get the checkbox for whether the inactive time is hidden or shown
    let local_data = local_storage_data.trackingData;

    const checkbox_hide_inactive_time = document.getElementById("checkbox-hide-inactive-time");
    checkbox_hide_inactive_time.checked = local_data.UI_hide_inactive_times;
    checkbox_hide_inactive_time.addEventListener('change', async function () {
      local_data.UI_hide_inactive_times = checkbox_hide_inactive_time.checked;
      await chrome.storage.local.set({ trackingData: local_data });

      // Draw horizontal bar chart with the sorted segments
      const allTimes = mergeAndSortTimes(local_data.productive_times[0], local_data.distracted_times[0], local_data.logoff_times[0]);
      createBarChart(allTimes);
    });

    // Draw horizontal bar chart with the sorted segments
    const allTimes = mergeAndSortTimes(local_data.productive_times[0], local_data.distracted_times[0], local_data.logoff_times[0]);
    createBarChart(allTimes);
  });
});

// Pie Chart
function drawPieChart(data, colors) {
  const svgNS = "http://www.w3.org/2000/svg";
  const chart = document.getElementById('pie-chart');
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

// Horizontal Bar Graph
function mergeAndSortTimes(productiveTimes, distractedTimes, logoffTimes) {
  const allTimes = [];

  productiveTimes.forEach(time => {
    allTimes.push({ time: new Date(time), label: 'Productive' });
  });
  distractedTimes.forEach(time => {
    allTimes.push({ time: new Date(time), label: 'Distracted' });
  });
  logoffTimes.forEach(time => {
    allTimes.push({ time: new Date(time), label: 'Logoff' });
  });

  // Sort all times by date
  allTimes.sort((a, b) => a.time - b.time);
  console.log(allTimes);
  return allTimes;
}

// Function to create a segmented horizontal bar chart
function createBarChart(data) {
  const chart = document.getElementById('horizontal-bar-chart');
  chart.innerHTML = ''; // Clear previous chart

  const checkbox_hide_inactive_time = document.getElementById("checkbox-hide-inactive-time");
  let totalDuration = 0;
  for (let i = 1; i < data.length; i++) {
    if (!(data[i - 1].label === 'Logoff' &&
      checkbox_hide_inactive_time.checked)
    ) {
      totalDuration += (data[i].time - data[i - 1].time) / 1000; // Calculate total duration in seconds
    }
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i - 1].label === 'Logoff' &&
      checkbox_hide_inactive_time.checked
    ) {
      continue;
    }
    const duration = (data[i].time - data[i - 1].time) / 1000;
    const segmentDiv = document.createElement('div');
    segmentDiv.classList.add('segment');
    segmentDiv.style.width = `${(duration / totalDuration) * 100}%`;

    if (data[i - 1].label === 'Productive') {
      segmentDiv.style.backgroundColor = '#4682B4';
    } else if (data[i - 1].label === 'Distracted') {
      segmentDiv.style.backgroundColor = '#FF6347';
    } else {
      segmentDiv.style.backgroundColor = '#D3D3D3';
    }

    // Add a tooltip for each segment
    segmentDiv.title = `${data[i - 1].label}: ${duration} seconds`;

    chart.appendChild(segmentDiv);
  }
}