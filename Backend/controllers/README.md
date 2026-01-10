# Controllers Documentation

This document provides a detailed explanation of all controllers in the backend, including their routes, middleware, and functionality.

## Table of Contents
- [Authentication Middleware](#authentication-middleware)
- [User Controller](#user-controller)
- [Payment Method Controller](#payment-method-controller)

## Authentication Middleware
**File:** `middleware.js`

The authentication middleware verifies JWT tokens for protected routes.

```javascript
const isLoggedIn = async (req, res, next) => {
    try {
        if (req.headers.authorization) {
            const token = req.headers.authorization.split(" ")[1];
            if (token) {
                const payload = await jwt.verify(token, process.env.SECRET || "jafha71yeiqquy1#@!");
                if (payload) {
                    req.user = payload;
                    next();
                } else {
                    res.status(400).json({ error: "token verification failed" });
                }
            }
        } else {
            res.status(400).json({ error: "No authorization header" });
        }
    } catch (error) {
        res.status(400).json({ error });
    }
};
```

**Key Features:**
- Extracts JWT token from Authorization header
- Verifies token authenticity
- Attaches user payload to request object
- Error handling for invalid/missing tokens

## User Controller
**File:** `user.js`

Manages user authentication and profile operations.

### Key Endpoints:

1. **Register User**
```javascript
userRouter.post("/register", async (req, res) => {
    try {
        let { name, email, password, type } = req.body;
        // Input validation using Joi
        const schema = Joi.object({
            name: Joi.string().required(),
            email: Joi.string().min(8).max(50).required().email(),
            password: Joi.string().min(6).required().max(20)
                .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,1024}$/),
            type: Joi.string().valid("admin", "valet"),
        });
        // Password encryption & user creation
        password = bcrypt.hashSync(password, 10);
        const user = await User.create({ name, email, password, type });
    }
});
```

2. **Login User**
```javascript
userRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user) {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
                const token = await jwt.sign({ email: user.email }, SECRET_JWT_CODE);
                res.json({ user, token });
            }
        }
    }
});
```

**Features:**
- User registration with role selection
- Secure password hashing
- JWT token generation
- Input validation using Joi
- Password strength requirements

## Payment Method Controller
**File:** `paymentMethod.js`

Manages payment methods for users.

### Key Endpoints:

1. **Create Payment Method**
```javascript
paymentMethodRouter.post("/", async (req, res) => {
    try {
        let { cash, interac } = req.body;

        const schema = Joi.object({
            cash: Joi.boolean().required(),
        });

        const paymentMethod = await PaymentMethod.create({ 
            cash, interac 
        });
    }
});
```

**Features:**
- Payment method creation
- Multiple payment type support
- Input validation
- Payment method updates

## Common Features Across Controllers

1. **Input Validation**
- All controllers use Joi for request validation
- Structured validation schemas
- Consistent error handling

2. **Error Handling**
```javascript
try {
    // Controller logic
} catch (error) {
    console.error("error - ", error);
    res.status(400).json({ error });
}
```

3. **Response Format**
- Success responses include data/message
- Error responses include error details
- Consistent HTTP status codes

4. **Database Operations**
- Mongoose models for data operations
- Population of related data
- Transaction handling where needed

5. **Security**
- JWT authentication
- Input sanitization
- Role-based access control
- Data validation

This documentation provides a comprehensive overview of the backend controllers and their functionality. Each controller is designed to handle specific aspects of the system while maintaining consistency in error handling, validation, and security measures. 