const { Router } = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken");
const User = require("../models/userSchema");
const Joi = require('joi');
const { Types } = require("mongoose");
const { isLoggedIn } = require("./middleware");
const upload = require("../config/multer.config");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const twilio = require('twilio');

const userRouter = Router();

const { SECRET_JWT_CODE = "jafha71yeiqquy1#@!" } = process.env;
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, DOMAIN_NAME } = process.env;

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Function to send SMS
const sendSms = async (to, message) => {
    try {
        await twilioClient.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: to
        });
        console.log(`SMS sent to ${to}`);
    } catch (error) {
        console.error(`Error sending SMS to ${to}:`, error);
    }
};

// Export sendSms so other controllers (e.g., parkedCar) can use it
module.exports.sendSms = sendSms;

// Register new user endpoint - DISABLED (only system admin can create users)
userRouter.post("/register", async (req, res) => {
    res.status(403).json({ error: "Public registration is disabled. Please contact system administrator." });
});

// Create user endpoint - Only for system admin
userRouter.post("/create", isLoggedIn, async (req, res) => {
    try {
        // Get user from database to check type (since JWT only has email)
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });
        if (!currentUser || currentUser.type !== "system_admin") {
            return res.status(403).json({ error: "Only system admin can create users" });
        }

        let { name, phoneNumber, password, type, parkZoneCode, priceLevel } = req.body;
        
        // Normalize phone number: remove spaces, dashes, parentheses, and other formatting
        if (phoneNumber) {
            phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        }
        
        console.log('Create user request received:', { 
            name, 
            phoneNumber, 
            passwordLength: password?.length, 
            type, 
            parkZoneCode,
            hasAuth: !!req.user 
        });

        // Input validation - accept various phone number formats (matching login endpoint)
        const schema = Joi.object({
            name: Joi.string().trim().required()
                .messages({
                    "string.base": `"name" should be a type of 'text'`,
                    "any.required": `"name" is a required field`,
                    "string.empty": `"name" cannot be empty`
                }),
            phoneNumber: Joi.string()
                .trim()
                .required()
                .pattern(/^(\+?251|0)?[0-9]{9}$|^(\+)?[0-9]{10,15}$/)
                .messages({
                    "string.base": `"phoneNumber" should be a type of 'text'`,
                    "string.pattern.base": `"phoneNumber" must be a valid phone number (spaces and formatting will be removed automatically)`,
                    "any.required": `"phoneNumber" is a required field`,
                    "string.empty": `"phoneNumber" cannot be empty`
                }),
            password: Joi.string()
                .min(8)
                .required()
                .max(20)
                .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,1024}$/)
                .messages({
                    "string.base": `"password" should be a type of 'text'`,
                    "string.pattern.base": `"password" should have one uppercase, lowercase, digit and special character`,
                    "string.min": `"password" should have min 8 characters`,
                    "string.max": `"password" should have max 20 characters`,
                    "any.required": `"password" is a required field`,
                    "string.empty": `"password" cannot be empty`
                }),
            type: Joi.string()
                .valid("system_admin", "manager", "admin", "valet")
                .required()
                .messages({
                    "any.only": `"type" must be one of: system_admin, manager, admin, valet`,
                    "any.required": `"type" is a required field`,
                    "string.empty": `"type" cannot be empty`
                }),
            parkZoneCode: Joi.string()
                .trim()
                .when('type', {
                    is: Joi.string().valid('valet'),
                    then: Joi.string().required().min(1).messages({
                        "any.required": `"parkZoneCode" is required for valet users`,
                        "string.empty": `"parkZoneCode" cannot be empty`
                    }),
                    otherwise: Joi.string().optional().allow('', null)
                }),
            priceLevel: Joi.string()
                .trim()
                .optional()
                .allow('', null)
        })

        // Clean and prepare data for validation (phone number already normalized above)
        const cleanData = {
            name: name?.trim() || '',
            phoneNumber: phoneNumber || '',
            password: password || '',
            type: type || '',
            parkZoneCode: parkZoneCode?.trim() || '',
            priceLevel: priceLevel?.trim() || null
        };

        const { error: validationError, value: validatedData } = schema.validate(cleanData);
        if (validationError) {
            console.log('Validation error details:', validationError.details);
            return res.status(400).json({ error: validationError.details[0].message });
        }
        
        // Use validated and cleaned data
        name = validatedData.name;
        phoneNumber = validatedData.phoneNumber;
        password = validatedData.password;
        type = validatedData.type;
        parkZoneCode = validatedData.parkZoneCode || '';
        priceLevel = validatedData.priceLevel || null;
        
        // Normalize phone number to handle different formats (same as login)
        let normalizedPhone = phoneNumber.trim();
        
        // If it starts with 0 and is 10 digits, convert to international format (+251)
        if (normalizedPhone.startsWith('0') && normalizedPhone.length === 10) {
            normalizedPhone = '+251' + normalizedPhone.substring(1);
        } else if (!normalizedPhone.startsWith('+') && normalizedPhone.length === 9) {
            // If it's 9 digits without country code, add +251
            normalizedPhone = '+251' + normalizedPhone;
        } else if (!normalizedPhone.startsWith('+') && normalizedPhone.length === 12 && normalizedPhone.startsWith('251')) {
            // If it's 12 digits starting with 251 but no +, add +
            normalizedPhone = '+' + normalizedPhone;
        }
        
        // Use normalized phone number for database operations
        const phoneToUse = normalizedPhone !== phoneNumber.trim() ? normalizedPhone : phoneNumber.trim();
        
        const user = await User.findOne({ phoneNumber: phoneToUse });
        if (user) {
            return res.status(400).json({ error: "Phone number already in use" });
        }
        else {
            // Password encryption
            const rawPassword = password; // Store raw password before hashing for SMS
            const hashedPassword = bcrypt.hashSync(password, 10);
            const newUser = await User.create({ name, phoneNumber: phoneToUse, password: hashedPassword, type, parkZoneCode, priceLevel });
            
            // Send SMS with credentials (use normalized phone for SMS)
            try {
                const smsMessage = `Welcome to ${DOMAIN_NAME}! Your account has been created.\nPhone Number: ${phoneToUse}\nPassword: ${rawPassword}\nLogin here: ${DOMAIN_NAME}/login`;
                await sendSms(phoneToUse, smsMessage);
            } catch (smsError) {
                console.error('SMS sending failed (user still created):', smsError);
                // Don't fail user creation if SMS fails
            }

            // Don't send password in response
            const userResponse = { ...newUser.toObject() };
            delete userResponse.password;
            res.json({ user: userResponse, message: "User created successfully" });
        }
    } catch (error) {
        console.error("Create user error:", error);
        const errorMessage = error?.message || error?.toString() || 'Failed to create user';
        res.status(400).json({ error: errorMessage });
    }
});


// Get user list
    userRouter.get("/", async (req, res) => {
        try {
            const users = await User.find({}).select('-password'); // Exclude password from results
    
            res.json(users);
        } catch (error) {
        console.error('error ', error);
        res.status(400).json({ error });
    }
});


// Login existing user endpoint
userRouter.post("/login", async (req, res) => {
    try {
        let { phoneNumber, password } = req.body;
        
        // Normalize phone number: remove spaces, dashes, parentheses, and other formatting
        if (phoneNumber) {
            phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        }
        
        console.log('Login attempt - phoneNumber:', phoneNumber, 'password length:', password?.length);

        // Input validation - accept various phone number formats
        const schema = Joi.object({
            phoneNumber: Joi.string()
                .required()
                .pattern(/^(\+?251|0)?[0-9]{9}$|^(\+)?[0-9]{10,15}$/)
                .messages({
                    "string.base": `"phoneNumber" should be a type of 'text'`,
                    "string.pattern.base": `"phoneNumber" must be a valid phone number (spaces and formatting will be removed automatically)`,
                    "any.required": `"phoneNumber" is a required field`
                }),
            password: Joi.string()
                .min(6)
                .required()
                .max(20)
                .messages({
                    "string.base": `"password" should be a type of 'text'`,
                    "string.min": `"password" should have min 6 characters`,
                    "string.max": `"password" should have max 20 characters`,
                    "any.required": `"password" is a required field`
                }),
        })

        const { error } = schema.validate({ phoneNumber, password });
        if (error) {
            console.log('Validation error:', error.details[0].message);
            return res.status(400).json({ error: error.details[0].message });
        }
        else {
            // Normalize phone number to handle different formats
            let normalizedPhone = phoneNumber.trim();
            
            // If it starts with 0 and is 10 digits, convert to international format (+251)
            if (normalizedPhone.startsWith('0') && normalizedPhone.length === 10) {
                normalizedPhone = '+251' + normalizedPhone.substring(1);
            } else if (!normalizedPhone.startsWith('+') && normalizedPhone.length === 9) {
                // If it's 9 digits without country code, add +251
                normalizedPhone = '+251' + normalizedPhone;
            } else if (!normalizedPhone.startsWith('+') && normalizedPhone.length === 12 && normalizedPhone.startsWith('251')) {
                // If it's 12 digits starting with 251 but no +, add +
                normalizedPhone = '+' + normalizedPhone;
            }
            
            // Try exact match first, then try normalized version
            let user = await User.findOne({ phoneNumber: phoneNumber.trim() });
            if (!user && normalizedPhone !== phoneNumber.trim()) {
                console.log('Trying normalized phone number:', normalizedPhone);
                user = await User.findOne({ phoneNumber: normalizedPhone });
            }
            
            if (user) {
                // Check if password matches
                const result = await bcrypt.compare(password, user.password);
                if (result) {
                    // Generating and sending JWT token for authorization
                    const token = await jwt.sign({ phoneNumber: user.phoneNumber, type: user.type, _id: user._id }, SECRET_JWT_CODE);
                    // Don't send password in response
                    const userResponse = { ...user.toObject() };
                    delete userResponse.password;
                    res.json({ user: userResponse, token });
                } else {
                    res.status(400).json({ error: "password doesn't match" });
                }
            } else {
                res.status(400).json({ error: "User doesn't exist" });
            }
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(400).json({ error: error?.message || "Login failed. Please try again." });
    }
});

// Reset password endpoint
userRouter.post("/resetPassword/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body

        console.log('id - ', id);
        console.log('password ', password);
        if (Types.ObjectId.isValid(id)) {
            const user = await User.findById({ _id: id })
            if (!user) {
                res.status(400).json({ error: "Provide correct user id" })
            }
            else {
                // Input validation
                const schema = Joi.object({
                    password: Joi.string()
                        .required()
                        .min(8)
                        .max(20)
                        .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,1024}$/)
                        .messages({
                            "string.base": `"password" should be a type of 'text'`,
                            "string.pattern.base": `"password" should have one uppercase, lowercase, digit and special character`,
                            "string.min": `"password" should have min 8 characters`,
                            "string.max": `"password" should have max 20 characters`,
                            "any.required": `"password" is a required field`
                        }),
                })

                const { error } = schema.validate({ password });
                if (error) {
                    res.status(400).json({ error: error.details[0].message });
                }
                else {
                    // Encrypting password before updating user
                    if (password) {
                        user.password = bcrypt.hashSync(password, 10);
                    }
                    user.save().then(user => {
                        res.json({ user, message: 'Password updated successfully' });
                    })
                }
            }
        }
        else {
            res.status(400).json({ error: "Invalid id" })
        }

    } catch (error) {
        console.error(error);
        res.status(400).json({ error });
    }
});


// Upload profile photo endpoint
userRouter.post("/:id/upload-photo", (req, res, next) => {
    console.log('Upload endpoint hit, ID:', req.params.id);
    upload.single('profilePhoto')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            // Handle multer errors
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File size too large. Maximum size is 20MB' });
                }
                return res.status(400).json({ error: err.message || 'File upload error' });
            }
            // Handle other errors
            return res.status(400).json({ error: err.message || 'File upload failed' });
        }
        console.log('File uploaded successfully:', req.file ? req.file.filename : 'No file');
        next();
    });
}, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Processing upload for user ID:', id);

        if (!Types.ObjectId.isValid(id)) {
            console.error('Invalid user ID:', id);
            return res.status(400).json({ error: "Invalid user id" });
        }

        if (!req.file) {
            console.error('No file in request');
            return res.status(400).json({ error: "No file uploaded" });
        }

        console.log('Finding user with ID:', id);
        const user = await User.findById(id);
        if (!user) {
            console.error('User not found:', id);
            // Delete uploaded file if user doesn't exist
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: "User not found" });
        }

        console.log('User found, deleting old photo if exists');
        // Delete old profile photo if exists
        if (user.profilePhoto) {
            const oldPhotoPath = path.join(__dirname, '../uploads/profile-photos', path.basename(user.profilePhoto));
            if (fs.existsSync(oldPhotoPath)) {
                try {
                    fs.unlinkSync(oldPhotoPath);
                    console.log('Deleted old photo:', oldPhotoPath);
                } catch (unlinkError) {
                    console.error('Error deleting old photo:', unlinkError);
                    // Continue even if old photo deletion fails
                }
            }
        }

        // Save profile photo path (relative to uploads folder)
        const photoPath = `/uploads/profile-photos/${req.file.filename}`;
        console.log('Saving photo path:', photoPath);
        user.profilePhoto = photoPath;
        await user.save();
        console.log('User saved successfully');

        // Don't send password in response
        const userResponse = { ...user.toObject() };
        delete userResponse.password;

        res.json({ user: userResponse, message: 'Profile photo uploaded successfully' });
    } catch (error) {
        console.error('Upload error:', error);
        console.error('Error stack:', error.stack);
        // Delete uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
            }
        }
        res.status(500).json({ error: error.message || 'Failed to upload profile photo' });
    }
});

// Update user endpoint
userRouter.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { cash, interac, name, phoneNumber, parkZoneCode } = req.body

        console.log('id - ', id);
        if (Types.ObjectId.isValid(id)) {
            const user = await User.findById({ _id: id })
            if (!user) {
                res.status(400).json({ error: "Provide correct user id" })
            }
            else {
                let hasUpdates = false;

                if (typeof cash === "boolean") {
                    user.cash = cash;
                    hasUpdates = true;
                }
                if (interac) {
                    user.interac = interac;
                    hasUpdates = true;
                }
                if (name && name.trim() !== '') {
                    user.name = name.trim();
                    hasUpdates = true;
                }
                if (phoneNumber && phoneNumber.trim() !== '') {
                    // Check if phone number is already in use by another user
                    const existingUser = await User.findOne({ phoneNumber });
                    if (existingUser && existingUser._id.toString() !== id) {
                        return res.status(400).json({ error: 'Phone number already in use by another user' });
                    }
                    user.phoneNumber = phoneNumber.trim();
                    hasUpdates = true;
                }
                if (parkZoneCode && parkZoneCode.trim() !== '') {
                    user.parkZoneCode = parkZoneCode.trim();
                    hasUpdates = true;
                }

                if (!hasUpdates) {
                    res.status(400).json({ error: 'Must provide at least one field to update (cash, interac, name, phoneNumber, or parkZoneCode)' });
                } else {
                    user.save().then(user => {
                        // Don't send password in response
                        const userResponse = { ...user.toObject() };
                        delete userResponse.password;
                        res.json({ user: userResponse, message: 'User updated successfully' });
                    })
                }
            }
        }
        else {
            res.status(400).json({ error: "Invalid id" })
        }

    } catch (error) {
        console.error(error);
        res.status(400).json({ error });
    }
});

// Delete user endpoint
userRouter.route('/delete/:id').delete(async (req, res) => {
    try {
        const { id } = req.params

        // Validate id and delete user if exist
        if (Types.ObjectId.isValid(id)) {
            const user = await User.findByIdAndDelete({ _id: id })

            if (user) {
                res.json({ message: "User deleted successfully" })
            }
            else {
                res.status(404).json({ error: "User not found" })
            }
        }
        else {
            res.status(400).json({ error: "Invalid user id" })
        }
    } catch (error) {
        res.status(400).json({ error })
    }

});


module.exports = userRouter