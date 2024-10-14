// TODO: Move the calculation to background.js so that we don't need to store every website. 
// Make background.js store a cache of websites and whether they are a distraction so we don't constantly use resources to calculate.
// Figure out what we need to store in chrome.storage.sync for maximum functionality
// Properly calculate the time spent (parsing the Date objects)
import { focusTabUpdate } from './background.js';

function parseSeconds(seconds) {
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
    
    // Calculate the total productive time
    const productiveElement = document.getElementById("time_productive");
    if (cloud_data.total_time_productive[0] > 0) {
      productiveElement.innerHTML = '<i class="row">' + parseSeconds(cloud_data.total_time_productive[0]) + '</i>';
    } else {
      productiveElement.innerHTML = '<i class="row">No time was spent being productive!</i>';
    }
  
    // Calculate the total distracted time
    const distractedElement = document.getElementById("time_distracted");
    if (cloud_data.total_time_distracted[0] > 0) {
      distractedElement.innerHTML = '<i class="row">' + parseSeconds(cloud_data.total_time_distracted[0]) + '</i>';
    } else {
      distractedElement.innerHTML = '<i class="row">No time was spent being distracted!</i>';
    }  
  });
});
