// If a tab is updated (eg. searching a page, log that tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only Log if info changed
  if (changeInfo.status === 'complete') {
    await focusTabUpdate(tab);
  }
});

// If a tab is switched to, log that tab
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, async function(tab) {
    await focusTabUpdate(tab);
  });
});

let cache = {};

// HELPER
// Update the storage with the information of the currently focused tab
async function focusTabUpdate(tab) {
  if (tab.url) {
    let local_storage_data = await chrome.storage.local.get("trackingData");
    let data = local_storage_data.trackingData || {
      time_productive_per_site: {
      },
      time_distracted_per_site: {
      },
      productive_times: {
        "day_0": [],
        "day_1": [],
        "day_2": [],
        "day_3": [],
        "day_4": [],
        "day_5": [],
        "day_6": []
      },
      distracted_times: {
        "day_0": [],
        "day_1": [],
        "day_2": [],
        "day_3": [],
        "day_4": [],
        "day_5": [],
        "day_6": []
      },
      logoff_times: {
        "day_0": [],
        "day_1": [],
        "day_2": [],
        "day_3": [],
        "day_4": [],
        "day_5": [],
        "day_6": []
      }
    };

    const now_time = new Date();

    // The is_distracting field is evaluated in popup.js when the DOM is loaded
    const time_entry = {
      tab_url: tab.url,
      tab_title: tab.title,
      time_visited: now_time.toString(),
      is_distracting: null
    };

    data.push(time_entry);

    console.log(data);

    // await chrome.storage.sync.set({ time_used: data });
    await chrome.storage.local.set({ trackingData: data });
  }
}

// If the user switches to a non-chrome window, potentially have different functionality?
// Not obvious how to deal with this because the user might eg. have a lecture playing in an unfocused
// window whilst taking notes.
// chrome.windows.onFocusChanged.addListener(function(windowId) {
//   if (windowId === chrome.windows.WINDOW_ID_NONE) {
//     console.log("No Chrome window is currently in focus.");
//   } else {
//     console.log("Window with ID " + windowId + " is in focus.");
//   }
// });