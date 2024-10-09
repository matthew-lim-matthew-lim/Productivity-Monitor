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
