const express = require("express");
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
const cors = require('cors');

// Set body-parser
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

const port = process.env.PORT || 4000;

app.use(cors())

// Connect Database
connectDB();


app.get('/', isLoggedIn, async (req, res) => {
    res.json({ message: 'Hello world!'})
})

app.use("/user", userRouter)
app.use("/paymentMethod", paymentMethodRouter)
app.use("/payment", paymentRouter)
app.use("/parkedCar", parkedCarRouter)
app.use("/sms", smsRouter)

// Error handler

app.use((req, res, next) => {
    const error = new Error("Not Found")
    error.status = 404;
    next(error)
})

app.use((error, req, res, next) => {
    handleError(error, res);
})

app.listen(port, () => {
    console.log(`Running on http://localhost:${port}`)
})