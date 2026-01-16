const mongoose = require('mongoose');
require('dotenv').config();
// const logger = require('../logger/api.logger');

const connectDB = async () => {
    const url = process.env.MONODB_URI;

    if (!url) {
        console.error('MongoDB connection string (MONODB_URI) is not defined in environment variables');
        return;
    }

    try {
        await mongoose.connect(url, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        });

        mongoose.connection.once("open", async () => {
            console.log("Connected to database");
        });
          
        mongoose.connection.on("error", (err) => {
            console.log("Error connecting to database  ", err);
        });

        mongoose.connection.on("disconnected", () => {
            console.log("MongoDB disconnected. Attempting to reconnect...");
        });
    } catch (error) {
        console.error('Failed to connect to database:', error.message);
        console.error('Please check:');
        console.error('1. Your internet connection');
        console.error('2. MongoDB Atlas IP whitelist settings');
        console.error('3. MongoDB connection string in .env file');
        console.error('4. MongoDB Atlas cluster status');
        // Don't throw - allow the server to start even if DB is down
        // Routes will handle database errors gracefully
    }
}

module.exports = {
    connectDB
}