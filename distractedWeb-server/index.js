import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// Connect to MongoDB
const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
await client.connect();
const db = client.db('your-db-name'); // Replace with your database name
const urlsCollection = db.collection('urls');

// Initialize DeepSeek OpenAI client
const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
});

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
