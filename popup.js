// TODO: Move the calculation to background.js so that we don't need to store every website. 
// Make background.js store a cache of websites and whether they are a distraction so we don't constantly use resources to calculate.
// Figure out what we need to store in chrome.storage.sync for maximum functionality
// Properly calculate the time spent (parsing the Date objects)


function evaluateWhetherDistraction(tab_url, tab_title) {
  if (tab_url.includes("youtube.com")) {
    return true;
  } else {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  chrome.storage.sync.get(async () => {
    let result = await chrome.storage.sync.get("time_used");
    let data = result.time_used || [];

    // Assign each data object either distracting or productive.
    let productive_records = [];
    let distacted_records = [];

    for (let i = 0; i < data.length; i++) {
      // If it is not null, we don't waste resources re-determining if distracting or not
      if (data[i].is_distracting == null) {
        data[i].is_distracting = evaluateWhetherDistraction(data[i].tab_url, data[i].tab_title);
      } 
      
      if (data[i].is_distracting) {
        // is_distracting is true
        distacted_records.push(data[i]);
      } else {
        // is_distracting is false
        productive_records.push(data[i]);
      }
    }

    // Calculate the total productive time
    const productiveElement = document.getElementById("time_productive");
    if (productive_records.length > 0) {
      let productive_sum = 0;
      for (let i = 0; i < productive_records.length; i++) {
        productive_sum++;
      }
      productiveElement.innerHTML = '<i class="row">' + productive_sum + '</i>';
    } else {
      productiveElement.innerHTML = '<i class="row">No time was spent being productive!</i>';
    }
  
    // Calculate the total distracted time
    const distractedElement = document.getElementById("time_distracted");
    if (distacted_records.length > 0) {
      let distracted_sum = 0;
      for (let i = 0; i < distacted_records.length; i++) {
        distracted_sum++;
      }
      distractedElement.innerHTML = '<i class="row">' + distracted_sum + '</i>';
    } else {
      distractedElement.innerHTML = '<i class="row">No time was spent being distracted!</i>';
    }  
  });
});

