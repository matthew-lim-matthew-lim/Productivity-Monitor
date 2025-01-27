## Features to implement:

- See time spent on productive websites vs unproductive websites.
    - Generate pie chart for it.
    - Generate a horizontal graph to show how time was spend throughout the day (2 seperate colours for productive vs unproductive websites).
- See most frequented productive websites and unproductive websites.

### Extension goals:
- See the trends in distraction over several days and weeks. 
- Produce a heatmap over several days to show total productivity, and productivity percentage.

### Super extension goals:
- Social features (holding people accountable).

## Managing storage:
- `chrome.storage.sync` is 100kb data synced across different devices.
- `chrome.storage.local` is 5MB data on local device. Can be increased up to unlimited storage if the extension requests it on manifest.

Comes down to what cross-device functionality I want.
- View summarised results.
- In the future, store which device the website was visited on?

# Storage planning:

**Basic Data solution**

Data Structure in `cloud.storage.sync` (100kb max)

```cpp
const data = {
	total_time_productive: 10, // Store seconds, since 32-bit int allows for 68 yrs max.
	total_time_distracted: 100,
}
```

Data Structure in `cloud.storage.local` (5mb max)

- Should use unlimited storage request on the manifest.

```cpp
const data = {
  // Productive time tracked per site for each day of the past week
  time_productive_per_site: {
    "example.com": [120, 180, 200, 150, 170, 90, 110],  // Time in seconds for each day (0 = today, 6 = 6 days ago)
    "another-site.com": [45, 60, 75, 50, 30, 90, 40]
  },

  // Distracted time tracked per site for each day of the past week
  time_distracted_per_site: {
    "example.com": [300, 250, 200, 220, 180, 190, 210],
    "another-site.com": [100, 110, 90, 100, 60, 80, 70]
  },

	// Only store times that have at least a 2 minute difference (so switching tabs doesn't
	// take too much storage space.
	// Maybe this would require us to make a 2 minute timer of the user staying on the same 
	// site before adding it to productive_times (and etc). 
	// Do this later
	
  // Productive timestamps for each day (0 = today, 1 = yesterday, ..., 6 = 6 days ago)
  productive_times: {
    "day_0": ["2024-10-10T09:00:00Z", "2024-10-10T10:00:00Z"],  // Timestamps when user was productive today
    "day_1": ["2024-10-09T08:30:00Z"],                          // Timestamps for the previous day
    "day_2": ["2024-10-08T11:15:00Z", "2024-10-08T12:00:00Z"],   // Timestamps for 2 days ago
    "day_3": [],
    "day_4": ["2024-10-06T13:45:00Z"],
    "day_5": [],
    "day_6": ["2024-10-04T09:30:00Z"]
  },

  // Distracted timestamps for each day (0 = today, 1 = yesterday, ..., 6 = 6 days ago)
  distracted_times: {
    "day_0": ["2024-10-10T11:00:00Z", "2024-10-10T12:00:00Z"],
    "day_1": ["2024-10-09T14:15:00Z"],
    "day_2": [],
    "day_3": ["2024-10-07T16:30:00Z", "2024-10-07T17:00:00Z"],
    "day_4": [],
    "day_5": ["2024-10-05T18:45:00Z"],
    "day_6": ["2024-10-04T20:30:00Z"]
  }
  
  // Log off times for each day
  logoff_times: {
    "day_0": ["2024-10-10T11:00:00Z", "2024-10-10T12:00:00Z"],
    "day_1": ["2024-10-09T14:15:00Z"],
    "day_2": [],
    "day_3": ["2024-10-07T16:30:00Z", "2024-10-07T17:00:00Z"],
    "day_4": [],
    "day_5": ["2024-10-05T18:45:00Z"],
    "day_6": ["2024-10-04T20:30:00Z"]
  }
};
```

Cache Data Structure

- Cache distracting URLs (and maybe keywords)

```cpp
WIP
```

**Cloud stuff**
- Deciding between Google Firebase or Azure CosmosDB
  - CosmosDB is tempting as students have Azure credit for Education, and since I use it at my internship (at Prospa).
  - Firebase has a free teir and is very simple. Could be a good option since this extension is small.


**Final Data Solution**

- Likely more complex since it needs to store more data on the cloud. Will likely require the extension to have a server.



**Thoughts**

- Maybe syncing across devices is too hard?

**Notes:**

- Using `"background": { "type": "module" }` allows us to import and export.
  - https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics
- I wanna use CosmosDB for keeping track of what websites and URLs count as distractions

**`webpack` module bundling**
- Webpack is a module bundler which allows JS modules to be used in the chrome extension. It is necessary because Manifest V3 does not allow dynamic imports or eval for increased security, requiring all modules to be bundled into a single file or a set of static files.
- `npx webpack` to generate the distribution version of the files.

**Tech Used:**
- Firebase Firestore

**Final Release To Change**
- Use backend proxy that makes the API calls and returns the results to the extension. 