const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { connectDB } = require('../config/db.config');
const User = require('../models/userSchema');

// Default system admin credentials (change these!)
const DEFAULT_ADMIN = {
    name: 'System Administrator',
    phoneNumber: '+251934551781', // Example phone number (change this!)
    password: 'Admin@123', // Change this password!
    type: 'system_admin'
};

const seedAdmin = async () => {
    try {
        // Connect to database
        connectDB();

        // Wait for connection
        await new Promise((resolve) => {
            mongoose.connection.once('open', resolve);
        });

        console.log('Checking for existing system admin...');

        // Check if system admin already exists
        const existingAdmin = await User.findOne({ type: 'system_admin' });
        
        if (existingAdmin) {
            console.log('⚠️  System admin already exists!');
            console.log(`   Phone Number: ${existingAdmin.phoneNumber}`);
            console.log('   If you want to create a new one, delete the existing admin first.');
            process.exit(0);
        }

        // Hash password
        const hashedPassword = bcrypt.hashSync(DEFAULT_ADMIN.password, 10);

        // Create system admin
        const admin = await User.create({
            name: DEFAULT_ADMIN.name,
            phoneNumber: DEFAULT_ADMIN.phoneNumber,
            password: hashedPassword,
            type: DEFAULT_ADMIN.type,
            cash: false,
            interac: ''
        });

        console.log('✅ System admin created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📞 Phone Number:    ' + DEFAULT_ADMIN.phoneNumber);
        console.log('🔑 Password: ' + DEFAULT_ADMIN.password);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  IMPORTANT: Change the password after first login!');
        console.log('⚠️  Update the credentials in scripts/seedAdmin.js if needed.');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating system admin:', error.message);
        if (error.code === 11000) {
            console.error('   Phone number already exists in database.');
        }
        process.exit(1);
    }
};

// Run the seed script
seedAdmin();

