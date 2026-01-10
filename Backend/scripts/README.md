# Setup Scripts

## System Admin Setup

This directory contains scripts to set up the initial system administrator account.

### Creating System Admin

To create the initial system administrator, run:

```bash
npm run seed:admin
```

Or directly:

```bash
node scripts/seedAdmin.js
```

### Default Credentials

The default system admin credentials are:
- **Email:** `admin@tanapark.com`
- **Password:** `Admin@123`

⚠️ **IMPORTANT:** 
- Change these credentials in `scripts/seedAdmin.js` before running the script
- Change the password immediately after first login
- The script will not create a duplicate system admin if one already exists

### Customizing Credentials

Edit `scripts/seedAdmin.js` and modify the `DEFAULT_ADMIN` object:

```javascript
const DEFAULT_ADMIN = {
    name: 'Your Name',
    email: 'your-email@example.com',
    password: 'YourSecurePassword123!',
    type: 'system_admin'
};
```

**Password Requirements:**
- Minimum 6 characters
- Maximum 20 characters
- Must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one digit
  - At least one special character

### Troubleshooting

**Error: Email already exists**
- A system admin with this email already exists
- Delete the existing admin from the database or use a different email

**Error: Cannot connect to database**
- Make sure MongoDB is running
- Check your `.env` file has correct `MONODB_URI`
- Ensure the database connection string is correct

**Error: System admin already exists**
- The script detected an existing system admin
- To create a new one, delete the existing admin from the database first

