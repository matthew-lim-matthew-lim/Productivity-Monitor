import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';

dotenv.config();

// config
const MODEL_PATH = 'ml-model-data/tfjs_model/model.json';
const VOCAB_PATH = 'vocab.json';
const SEQ_LENGTH = 100;

// globals

let DISTRACTION_EVAL;
let model;
let wordToIndex = {};

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// Connect to MongoDB
const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
await client.connect();
const db = client.db('productivity-monitor');
const urlsCollection = db.collection('urls');


function tokenize(text) {
    const tokens = text.toLowerCase().split(/\s+/).map(w => wordToIndex[w] || 0);
    if (tokens.length > SEQ_LENGTH) {
      return tokens.slice(0, SEQ_LENGTH);
    } else {
      return tokens.concat(Array(SEQ_LENGTH - tokens.length).fill(0));
    }
}

async function evalDistractionMLModel(tabUrl, tabTitle) {
    const input = tf.tensor([tokenize(tabTitle)], [1, SEQ_LENGTH]);
    const output = model.predict(input);
    const score = (await output.data())[0];

    return score > 0.5;
}

// Initialize DeepSeek OpenAI client
const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
});

async function evalDistractionLLM(tabUrl, tabTitle) {
    // Prepare the prompt for DeepSeek
    const prompt = `Determine if this website is a distraction that hinders productivity.
    Answer with only "Yes" (distracting) or "No" (not distracting).
    tabUrl: ${tabUrl}
    tabTitle: ${tabTitle || 'N/A'}`;
    
    // Call DeepSeek API for classification
    const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: prompt }],
        model: "deepseek-chat",
    });

    const responseText = completion.choices[0].message.content.trim();
    const isDistraction = responseText === "Yes";

    // Save the result in MongoDB
    await urlsCollection.insertOne({
        url: tabUrl,
        title: tabTitle,
        distraction: isDistraction,
        evaluatedAt: new Date(),
    });

    return isDistraction;
}

// Endpoint to evaluate if a URL is distracting
app.post('/api/evaluate', async (req, res) => {
    const { tabUrl, tabTitle } = req.body;
    if (!tabUrl) {
        return res.status(400).json({ error: 'tabUrl is required' });
    }

    try {
        // Check if URL is already classified in the database
        const existingEntry = await urlsCollection.findOne({ url: tabUrl });
        if (existingEntry) {
            return res.json({ distraction: existingEntry.distraction });
        }

        let isDistraction = true;
        // Use different eval mechanism depending on the argument when server was run.
        if (DISTRACTION_EVAL == "LLM") {
            isDistraction = evalDistractionLLM(tabUrl, tabTitle);
        } else {
            isDistraction = evalDistractionMLModel(tabUrl, tabTitle);
        }

        console.log("Distraction evaluation result for " + tabUrl + ": " + responseText);

        res.json({ distraction: isDistraction });
    } catch (error) {
        console.error("Error during distraction evaluation:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Mean Shift Clustering for determining the most productive time

// Convert timestamps to float hours in UTC
function extractHourFloats(timesMap) {
    return Object.values(timesMap).flat().map(ts => {
      const d = new Date(ts);
      return d.getUTCHours() + d.getUTCMinutes() / 60;
    });
  }
  
  // 1D Mean Shift implementation
  function meanShift1D(data, bandwidth = 1.0, maxIter = 100, epsilon = 0.01) {
    const shifted = data.map(p => p); // copy
    for (let iter = 0; iter < maxIter; iter++) {
      let hasChanged = false;
      for (let i = 0; i < shifted.length; i++) {
        const xi = shifted[i];
        // Get all points within bandwidth
        const neighbors = data.filter(xj => Math.abs(xj - xi) <= bandwidth);
        if (neighbors.length === 0) continue;
        const mean = neighbors.reduce((sum, x) => sum + x, 0) / neighbors.length;
        if (Math.abs(mean - xi) > epsilon) {
          shifted[i] = mean;
          hasChanged = true;
        }
      }
      if (!hasChanged) break;
    }
    return shifted;
  }
  
// Group shifted points into clusters
function clusterPeaks(shifted, tolerance = 0.5) {
    const clusters = [];    
    for (let x of shifted) {
        let found = false;
        for (let c of clusters) {
        if (Math.abs(c.center - x) <= tolerance) {
            c.points.push(x);
            c.center = c.points.reduce((a, b) => a + b, 0) / c.points.length;
            found = true;
            break;
        }
        }
        if (!found) clusters.push({ center: x, points: [x] });
    }
    return clusters;
}

function floatToHourMinute(timeFloat) {
    const hour = Math.floor(timeFloat);
    const minute = Math.round((timeFloat - hour) * 60);
    return { hour, minute };
}
  

// Endpoint to find the most productive time using mean shift clustering
app.post('/api/calculate-most-productive-time', async (req, res) => {
    const { data } = req.body;

    const hourData = extractHourFloats(data.productive_times);
    const shifted = meanShift1D(hourData, 1.0);
    const clusters = clusterPeaks(shifted);
    clusters.sort((a, b) => b.points.length - a.points.length);

    if (clusters.length > 0) {
        const { hour, minute } = floatToHourMinute(clusters[0].center);
        res.json({
          mostProductiveUTC: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        });
    } else {
        res.status(400).json({ error: 'No Productive time found. Likely not enough data provided.' });
    }
});


// Main and initialisation

// Load Vocab 
function loadVocab() {
  const vocab = JSON.parse(fs.readFileSync(VOCAB_PATH));
  vocab.forEach((word, idx) => {
    wordToIndex[word] = idx;
  });
}

// Main
(async () => {
  const evalMechanism = process.argv[2];
  if (!(evalMechanism == "LLM" || evalMechanism == "ML")) {
    console.log("No explicit eval mechanism provided, defaulting to LLM");
    DISTRACTION_EVAL = "LLM";
  } else {
    DISTRACTION_EVAL = evalMechanism;
  }

  loadVocab();
  model = await tf.loadGraphModel('file://' + MODEL_PATH);
})();