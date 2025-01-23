// Import Firebase
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where } from "firebase/firestore";

// Initialize Firebase
const firebaseApp = initializeApp({
  apiKey: "AIzaSyDg-eVg_jsmKjlKhZH5Inoex0zIAIImw90",
  authDomain: "productivity-monitor-8715c.firebaseapp.com",
  projectId: "productivity-monitor-8715c",
  storageBucket: "productivity-monitor-8715c.firebasestorage.app",
  messagingSenderId: "284347340210",
  appId: "1:284347340210:web:6e1e5808272348a228c0ab",
  measurementId: "G-SHK3YKGFBJ"
});
var db = getFirestore(firebaseApp);

// Adding a document to Firestore
async function dbAddUrl(tabUrl, tabTitle, distractionState) {
  const urlsCollection = collection(db, "urls");
  const isClassified = await dbAlreadyClassified(tabUrl);
  if (isClassified) return;

  try {
    const docRef = await addDoc(urlsCollection, {
      url: tabUrl,
      title: tabTitle,
      distraction: distractionState,
    });
    console.log("Document written with ID:", docRef.id);
  } catch (error) {
    console.error("Error adding document:", error);
  }
}

// Querying Firestore
async function dbSeeUrl(tabUrl) {
  const urlsCollection = collection(db, "urls");
  const q = query(urlsCollection, where("url", "==", tabUrl));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    console.log(
      `${tabUrl} with title ${doc.data().title} is distracting: ${doc.data().distraction}`
    );
  });
}

// Check if URL is already classified
async function dbAlreadyClassified(tabUrl) {
  const urlsCollection = collection(db, "urls");
  const q = query(urlsCollection, where("url", "==", tabUrl));
  const querySnapshot = await getDocs(q);
  return querySnapshot.size > 0;
}

const Statuses = Object.freeze({
  PRODUCTIVE: 'productive',
  DISTRACTED: 'distracted',
  LOGOFF: 'logoff',
});

let currStatus = Statuses.LOGOFF;

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

// If browser is closing or extension is being unloaded, log that
chrome.runtime.onSuspend.addListener(async () => {
  const null_tab = {
    url: null
  };
  
  await focusTabUpdate(null_tab);
});

// When the window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // No focused window (e.g., user switched to another app or minimized browser)
    const null_tab = {
      url: null
    };
    await focusTabUpdate(null_tab);
  } else {
    // Browser window has focus again, get the active tab in the focused window
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });
    if (activeTab) {
      await focusTabUpdate(activeTab);
    }
  }
});


// Check if the window is out of focus in intervals
setInterval(checkBrowserFocus, 1000);  
function checkBrowserFocus(){
    chrome.windows.getCurrent(async function(browser){
      // If the browser is not focused, log it as logoff (if the current status isn't already loggoff)
      if (!browser.focused && currStatus != Statuses.LOGOFF) {
        const null_tab = {
          url: null
        };
        await focusTabUpdate(null_tab);
        currStatus = Statuses.LOGOFF;
      }
    })
}

function evaluateWhetherDistraction(tabUrl, tabTitle = null) {
  if (tabUrl.includes("youtube.com")) {
    dbAddUrl(tabUrl, tabTitle, true);
    currStatus = Statuses.DISTRACTED;
    return true;
  } else {
    dbAddUrl(tabUrl, tabTitle, false);
    currStatus = Statuses.PRODUCTIVE;
    return false;
  }
}

function getDayDifference(date1, date2) {
  // Convert both dates to milliseconds
  const time1 = date1.getTime();
  const time2 = date2.getTime();

  // Calculate the difference in milliseconds
  const diffInMillis = time2 - time1;

  // Convert the difference from milliseconds to days
  const diffInDays = diffInMillis / (1000 * 60 * 60 * 24);

  // Return the absolute value to ensure it's a positive number
  return Math.abs(Math.round(diffInDays));
}

let cache = {};

// HELPER
// Update the storage with the information of the currently focused tab
export async function focusTabUpdate(tab) {
  const now_time = new Date();
  let now_site = null;

  let cloud_storage_data = await chrome.storage.sync.get("trackingData");
  let cloud_data = cloud_storage_data.trackingData || {
    day_0_date: now_time.toString(),
    total_time_productive: [ 0, 0, 0, 0, 0, 0, 0 ], // Store seconds, since 32-bit int allows for 68 yrs max.
    total_time_distracted: [ 0, 0, 0, 0, 0, 0, 0 ]
  }

  let local_storage_data = await chrome.storage.local.get("trackingData");
  let local_data = local_storage_data.trackingData || {
    time_productive_per_site: {
    },
    time_distracted_per_site: {
    },
    productive_times: [[], [], [], [], [], [], []],
    distracted_times: [[], [], [], [], [], [], []],
    logoff_times: [[], [], [], [], [], [], []],
    UI_hide_inactive_times: false
  };

  // Shift the data for the past week down
  if (new Date(cloud_data.day_0_date).getDate() != now_time.getDate()) {
    console.log("new date");
    const dayDifference = getDayDifference(new Date(cloud_data.day_0_date), now_time);
    console.log(dayDifference);
    for (let currDayIndex = 0; currDayIndex < 7; currDayIndex++) {
      if (currDayIndex + dayDifference < 7) {
        // Shift the cloud data for the past week down
        cloud_data.total_time_productive[currDayIndex + dayDifference] = cloud_data.total_time_productive[currDayIndex]; 
        cloud_data.total_time_productive[currDayIndex] = 0;
        cloud_data.total_time_distracted[currDayIndex + dayDifference] = cloud_data.total_time_distracted[currDayIndex]; 
        cloud_data.total_time_distracted[currDayIndex] = 0;

        // Shift the local data for the past week down
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
  // Add to total time if applicable
  // Find the last (previously logged) time (only need to query the last index of 3 arrays).
  // total_distracted += latest_time - distracted_times.day_0[last array index]

  // If there are no times already logged, then we don't know how stuff contributes to the total time.
  if (!(local_data.productive_times[0].length == 0 &&
    local_data.distracted_times[0].length == 0 &&
    local_data.logoff_times[0].length == 0
  )) {
    let productive_last = null;
    if (local_data.productive_times[0].length != 0) {
      const local_data_last_index = local_data.productive_times[0].length - 1;
      productive_last = new Date(local_data.productive_times[0][local_data_last_index]);
    }

    let distracted_last = null;
    if (local_data.distracted_times[0].length != 0) {
      const local_data_last_index = local_data.distracted_times[0].length - 1;
      distracted_last = new Date(local_data.distracted_times[0][local_data_last_index]);
    }

    let logoff_last = null;
    if (local_data.logoff_times[0].length != 0) {
      const local_data_last_index = local_data.logoff_times[0].length - 1;
      logoff_last = new Date(local_data.logoff_times[0][local_data_last_index]);
    }

    // If last time was productive, then add to total_productive. 
    // No null check required because JS does automatic conversion from null to 0.
    if (productive_last && productive_last > distracted_last && productive_last > logoff_last) {
      cloud_data.total_time_productive[0] += Math.floor((new Date(now_time) - productive_last) / 1000);
    }
  
    // If last time was distracted, then add to total_distracted.
    if (logoff_last && distracted_last > productive_last && distracted_last > logoff_last) {
      cloud_data.total_time_distracted[0] += Math.floor((new Date(now_time) - distracted_last) / 1000);
    }
  
    // If last time was logoff, then don't add to anything.
  }


  // If it is a logoff record, it tab.url will be null.
  if (tab.url) {
    // Determine if distracting or not
    console.log(tab.url, " ", tab.title);
    if (evaluateWhetherDistraction(tab.url, tab.title)) {
      // It is distracting
      local_data.distracted_times[0].push(now_time.toString());
    } else {
      // It is not distracting
      local_data.productive_times[0].push(now_time.toString());

      // Add to total productive time if applicable
    }
  } else {
    local_data.logoff_times[0].push(now_time.toString());
  }

  // console.log(cloud_data);
  // console.log(local_data);

  local_data.productive_times[0].forEach((item, index) => {
    // console.log(`Index ${index}:`, item);
  }); 

  await chrome.storage.sync.set({ trackingData: cloud_data });
  await chrome.storage.local.set({ trackingData: local_data });
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