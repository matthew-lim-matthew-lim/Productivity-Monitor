require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection error:", err));

// Define a schema and model for user data
const userDataSchema = new mongoose.Schema({
    url: String,
    title: String,
    distraction: Boolean,
    timestamp: { type: Date, default: Date.now },
});

const UserData = mongoose.model('UserData', userDataSchema);

// API endpoint to add user data
app.post('/api/data', async (req, res) => {
    try {
        const { url, title, distraction } = req.body;
        const newData = new UserData({ url, title, distraction });
        await newData.save();
        res.status(201).json({ message: 'Data saved successfully', id: newData._id });
    } catch (error) {
        console.error("Error saving data:", error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// API endpoint to retrieve user data
app.get('/api/data', async (req, res) => {
    try {
        const data = await UserData.find().sort({ timestamp: -1 });
        res.status(200).json(data);
    } catch (error) {
        console.error("Error retrieving data:", error);
        res.status(500).json({ error: 'Failed to retrieve data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
