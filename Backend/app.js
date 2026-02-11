const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const bodyParser = require("body-parser");
const { connectDB } = require("./config/db.config");
const userRouter = require("./controllers/user");
const handleError = require('./utils/errorHandler');
const { isLoggedIn } = require("./controllers/middleware");
const paymentMethodRouter = require("./controllers/paymentMethod");
const paymentRouter = require("./controllers/payment");
const parkedCarRouter = require("./controllers/parkedCar");
const smsRouter = require("./controllers/sms");
const pricingSettingsRouter = require("./controllers/pricingSettings");
const reportsRouter = require("./controllers/reports");
const chatRouter = require("./controllers/chat");
const cors = require('cors');

const port = process.env.PORT || 4000;

// CORS configuration - Apply BEFORE routes to handle preflight requests
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://tanapark.vercel.app/',
    process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined values

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // In development, allow all origins
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        // In production, check against allowed origins
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

// Set body-parser
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

// Connect Database (non-blocking - server will start even if DB connection fails)
connectDB().catch(err => {
    console.error('Database connection failed:', err.message);
    console.log('Server will continue to run, but database operations may fail');
});

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl)
            if (!origin || process.env.NODE_ENV !== 'production') {
                return callback(null, true);
            }
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                console.warn(`Socket.IO CORS blocked origin: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Make io available in routes
app.set('io', io);

io.on('connection', (socket) => {
    console.log('Socket.IO client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Socket.IO client disconnected:', socket.id);
    });
});

app.get('/', isLoggedIn, async (req, res) => {
    res.json({ message: 'Hello world!'})
})

app.use("/user", userRouter)
app.use("/paymentMethod", paymentMethodRouter)
app.use("/payment", paymentRouter)
app.use("/parkedCar", parkedCarRouter)
app.use("/sms", smsRouter)
app.use("/pricingSettings", pricingSettingsRouter)
app.use("/reports", reportsRouter)
app.use("/chat", chatRouter)

// Error handler

app.use((req, res, next) => {
    const error = new Error("Not Found")
    error.status = 404;
    next(error)
})

app.use((error, req, res, next) => {
    handleError(error, res);
})

server.listen(port, () => {
    console.log(`Running on http://localhost:${port}`)
})