# About this project

This project aims to allow users to have an intelligent insight into their device usage habits, helping them break bad habits and being more productive with their time.

Mid 2024, I realised that LLMs are an incredibly flexible and lightweight means of interpreting and interacting with the real world. I began this project to make a lightweight chrome extension that delineated the user's true productivity. I saw a need for this because other time trackers could not discern between distracting and educational content that was hosted on similar sites and domains. For example, YouTube can host both educational coding videos and also funny cat videos (which although fun, isn't very productive). The same is true for other sites like Medium, Reddit, and even news articles. 

The basic version had a UI that depicts how the user spends their time throughout the day, both in a pie-chart and in a timeline view. It would query the GPT api to determine if a particular site was a distraction or not, doing so in a way that preserved user privacy.

I then wanted to reduce the API calls, so I used Google Firebase Store to save the evaluations from GPT. At this stage, I opted to keep the app serverless to keep it as simple as possible. Also, DeepSeek released their own API which significantly reduced operational costs.

In Febuary of 2025, I taught myself how to make a neural network from scratch in C++. This helped demistify a lot of machine learning concepts, and inspired me to try and move the productivity-monitor chrome extension to use ML in order to operate without prompting an LLM. I built a server for the chrome extension and hosted it on Render (a service like Heroku). I made the distraction evaluation queries route to the server and switched the database to use MongoDB. 

The reason I switched to MongoDB is for a couple reasons. Firstly, Firebase is more of a serverless approach, which is what the chrome extension was transitioning away from. This adds a lot of complexity and other features that I don't need and would prefer to handle myself on the server. Firebase can also be more expensive since it has a pay-as-you-go model, whereas in MongoDB there is a free teir. Overall, MongoDB is simpler to work with and it feels more robust for my use case.

However, I didn't let the Firebase evaluation data go to waste. After all, I had been collecting at least 4 month's worth of data from when I was using it before I wanted to make the server. I wrote code in `distractedWeb-ml-model` to retrieve the Firebase data, and also code to train an ML model with this data. I ultimately then added functionality to the server to use the ML model if they started it with `node index.js ML`. However, the `node index.js LLM` option is still there. Running with the LLM option saves the evaluations to MongoDB, so that further models can be trained. Running with the ML option does not, as this would result in training using data that was output from the model itself, rather than a different source.  

Since we have a lot of user data, I realised that we can model the data and use techniques to make predictions, visualisations, and recommendations to help the user. Essentially, our data is like a time series, which is a highly-documented form of data (eg. weather, financial markets), meaning that the possibilities for interpreting this data are almost endless.

Recognising this, I decided to implement a time series forecast with a regular moving average as well as an exponential moving average to make predictions about when the user is most likely to be distracted next. This was a technique I learnt in the SIG Algothon in July 2024, where I made a trading algorithm that was trained to trade stocks on a fictional share market. In terms of trading bots, it is a very simple algorithm (and excels at losing money to other people on the market), but it is more than capable of predicting when the user of the productivity-monitor will next get distracted, and the odds of that event occurring. 

In Late Febuary of 2025, while taking COMP9517 (Computer Vision) at University, I came accross Mean Shift Clustering. Though originally introduced in the context of image segmentation, I realised its flexibility made it a great fit for analyzing time-based patterns in productivity. I was going to use K-Means clustering, but that required predefining the number of clusters, which might not be accurate. Mean Shift Clustering, on the other hand, dynamically identifies dense regions in the data, making it ideal of segmenting the day into periods of high and low productivity. As such, I used Mean Shift Clustering into the extension to provide users with personalised insights into their most and least productive hours.


![alt text](<readme-media/Screenshot 2025-04-03 201558.png>)
![alt text](<readme-media/Screenshot 2025-04-03 201607.png>)

# Documentation for this project

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
- `npx webpack` to generate the distribution version of the files. Make sure you run this in the `/distractedWeb-extension` directory.

**Tech Used:**
- Firebase Firestore

**Final Release To Change**
- Use backend proxy that makes the API calls and returns the results to the extension. 