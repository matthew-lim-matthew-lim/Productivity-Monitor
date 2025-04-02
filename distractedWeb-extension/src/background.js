chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "focusTabUpdate") {
    focusTabUpdate(message.tab);
    sendResponse({ status: "Success" });
  }
});

// Calls the backend API to evaluate whether a website is distracting.
async function evaluateWhetherDistraction(tabUrl, tabTitle = null) {
  try {
    const response = await fetch('https://productivity-monitor.onrender.com/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabUrl, tabTitle }),
    });
    console.log(response);
    const data = await response.json();
    return data.distraction;
  } catch (error) {
    console.error("Error calling distraction evaluation API:", error);
    return false; // Fallback status
  }
}

const Statuses = Object.freeze({
  PRODUCTIVE: 'productive',
  DISTRACTED: 'distracted',
  LOGOFF: 'logoff',
});

let currStatus = Statuses.LOGOFF;

// If a tab is updated (e.g., loading a new page), update focus status.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await focusTabUpdate(tab);
  }
});

// If a tab is switched to, update focus status.
chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.get(activeInfo.tabId, async function (tab) {
    await focusTabUpdate(tab);
  });
});

// If the browser is closing or the extension is being unloaded, log that.
chrome.runtime.onSuspend.addListener(async () => {
  await focusTabUpdate({ url: null });
});

// When the window focus changes.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await focusTabUpdate({ url: null });
  } else {
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });
    if (activeTab) {
      await focusTabUpdate(activeTab);
    }
  }
});

// Check if the window is out of focus in intervals.
setInterval(checkBrowserFocus, 1000);
function checkBrowserFocus() {
  chrome.windows.getCurrent(async function (browser) {
    if (!browser.focused && currStatus !== Statuses.LOGOFF) {
      await focusTabUpdate({ url: null });
      currStatus = Statuses.LOGOFF;
    }
  });
}

function getDayDifference(date1, date2) {
  const diffInMillis = date2.getTime() - date1.getTime();
  return Math.abs(Math.round(diffInMillis / (1000 * 60 * 60 * 24)));
}

let cache = {};

// HELPER: Update storage with information of the currently focused tab.
export async function focusTabUpdate(tab) {
  const now_time = new Date();

  // Retrieve tracking data from chrome.storage
  let cloud_storage_data = await chrome.storage.sync.get("trackingData");
  let cloud_data = cloud_storage_data.trackingData || {
    day_0_date: now_time.toString(),
    total_time_productive: [0, 0, 0, 0, 0, 0, 0],
    total_time_distracted: [0, 0, 0, 0, 0, 0, 0]
  };

  let local_storage_data = await chrome.storage.local.get("trackingData");
  let local_data = local_storage_data.trackingData || {
    time_productive_per_site: {},
    time_distracted_per_site: {},
    productive_times: [[], [], [], [], [], [], []],
    distracted_times: [[], [], [], [], [], [], []],
    logoff_times: [[], [], [], [], [], [], []],
    UI_hide_inactive_times: false
  };

  // Shift the data for a new day if needed.
  if (new Date(cloud_data.day_0_date).getDate() !== now_time.getDate()) {
    const dayDifference = getDayDifference(new Date(cloud_data.day_0_date), now_time);
    for (let currDayIndex = 0; currDayIndex < 7; currDayIndex++) {
      if (currDayIndex + dayDifference < 7) {
        cloud_data.total_time_productive[currDayIndex + dayDifference] = cloud_data.total_time_productive[currDayIndex];
        cloud_data.total_time_productive[currDayIndex] = 0;
        cloud_data.total_time_distracted[currDayIndex + dayDifference] = cloud_data.total_time_distracted[currDayIndex];
        cloud_data.total_time_distracted[currDayIndex] = 0;

        local_data.productive_times[currDayIndex + dayDifference] = structuredClone(local_data.productive_times[currDayIndex]);
        local_data.productive_times[currDayIndex] = [];
        local_data.distracted_times[currDayIndex + dayDifference] = structuredClone(local_data.distracted_times[currDayIndex]);
        local_data.distracted_times[currDayIndex] = [];
      }
      cloud_data.total_time_productive[currDayIndex] = 0;
      cloud_data.total_time_distracted[currDayIndex] = 0;
      local_data.productive_times[currDayIndex] = [];
      local_data.distracted_times[currDayIndex] = [];
    }
    cloud_data.day_0_date = now_time.toString();
  }

  // Add to total time if applicable.
  if (!(local_data.productive_times[0].length === 0 &&
    local_data.distracted_times[0].length === 0 &&
    local_data.logoff_times[0].length === 0)) {

    let productive_last = local_data.productive_times[0].length
      ? new Date(local_data.productive_times[0][local_data.productive_times[0].length - 1])
      : null;
    let distracted_last = local_data.distracted_times[0].length
      ? new Date(local_data.distracted_times[0][local_data.distracted_times[0].length - 1])
      : null;
    let logoff_last = local_data.logoff_times[0].length
      ? new Date(local_data.logoff_times[0][local_data.logoff_times[0].length - 1])
      : null;

    if (productive_last && productive_last > (distracted_last || 0) && productive_last > (logoff_last || 0)) {
      cloud_data.total_time_productive[0] += Math.floor((now_time - productive_last) / 1000);
    }
    if (distracted_last && distracted_last > (productive_last || 0) && distracted_last > (logoff_last || 0)) {
      cloud_data.total_time_distracted[0] += Math.floor((now_time - distracted_last) / 1000);
    }
  }

  // Process the tab update.
  if (tab.url) {
    console.log(tab.url, tab.title);
    if (await evaluateWhetherDistraction(tab.url, tab.title)) {
      local_data.distracted_times[0].push(now_time.toString());
    } else {
      local_data.productive_times[0].push(now_time.toString());
    }
  } else {
    local_data.logoff_times[0].push(now_time.toString());
  }

  await chrome.storage.sync.set({ trackingData: cloud_data });
  await chrome.storage.local.set({ trackingData: local_data });
}
