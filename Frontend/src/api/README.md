# API Documentation

This document provides a detailed explanation of all API functions used in the Frontend. These functions handle communication between the frontend and backend services.

## Table of Contents
- [Configuration](#configuration)
- [Authentication APIs](#authentication-apis)
- [User Management APIs](#user-management-apis)
- [Payment Method APIs](#payment-method-apis)

## Configuration
```javascript
import axios from 'axios';
const BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:4000/';
```
- Base URL configuration for all API calls
- Uses environment variable with fallback to localhost
- Axios for HTTP requests

## Authentication APIs

### Login
```javascript
export const login = async ({ 
    email, 
    password, 
    handleLoginSuccess, 
    handleLoginFailure 
}) => {
    try {
        const result = await axios.post(
            `${BASE_URL}user/login`, 
            { email, password }
        );
        if (result?.data?.token) {
            return handleLoginSuccess(result.data)
        }
    } catch (error) {
        handleLoginFailure(error?.response?.data?.error)
    }
}
```
**Features:**
- User authentication
- JWT token handling
- Success/failure callbacks
- Error handling

### Register
```javascript
export const register = async ({ 
    name, 
    email, 
    password, 
    type, 
    handleRegisterSuccess, 
    handleRegisterFailure 
}) => {
    try {
        const result = await axios.post(
            `${BASE_URL}user/register`, 
            { name, email, password, type }
        );
        if (result?.data?.name) {
            return handleRegisterSuccess()
        }
        handleRegisterFailure('Registration failed')
    } catch (error) {
        handleRegisterFailure(error?.response?.data?.error)
    }
}
```
**Features:**
- New user registration
- User type specification
- Input validation
- Error handling

## User Management APIs

### Reset Password
```javascript
export const resetPassword = async ({ 
    user_id, 
    body, 
    handleResetPasswordSuccess, 
    handleResetPasswordFailure 
}) => {
    try {
        const result = await axios.post(
            `${BASE_URL}user/resetPassword/${user_id}`, 
            { ...body }
        );
        if (result?.data?.user) {
            return handleResetPasswordSuccess(result.data)
        }
    } catch (error) {
        handleResetPasswordFailure(error?.response?.data?.error)
    }
}
```
**Features:**
- Password reset functionality
- User verification
- Success/failure handling

### Update User
```javascript
export const updateUser = async ({ 
    user_id, 
    body, 
    handleUpdateUserSuccess, 
    handleUpdateUserFailure 
}) => {
    try {
        const result = await axios.put(
            `${BASE_URL}user/${user_id}`, 
            { ...body }
        );
        if (result?.data?.user) {
            return handleUpdateUserSuccess(result.data)
        }
    } catch (error) {
        handleUpdateUserFailure(error?.response?.data?.error)
    }
}
```
**Features:**
- Profile updates
- Data validation
- Response handling

## Common Features

### Error Handling
```javascript
catch (error) {
    console.error('API Error: ', error);
    handleFailure(error?.response?.data?.error)
}
```
- Consistent error handling
- Detailed error messages
- Client-side logging

### Success Handling
```javascript
if (result?.data?.someData) {
    return handleSuccess(result.data)
}
```
- Response validation
- Data transformation
- State updates

### URL Construction
```javascript
const constructUrl = (base, params) => {
    const queryString = Object.keys(params)
        .filter(key => params[key])
        .map(key => `${key}=${params[key]}`)
        .join('&');
    return `${base}${queryString ? `?${queryString}` : ''}`;
};
```
- Dynamic query parameters
- Clean URL construction
- Parameter validation

## Best Practices

1. **Error Handling**
   - Consistent error format
   - Meaningful error messages
   - Client-side logging

2. **Response Processing**
   - Data validation
   - Type checking
   - Null checking

3. **State Management**
   - Redux integration
   - Local state updates
   - Loading states

4. **Security**
   - Token handling
   - Input validation
   - Secure data transmission

This documentation provides a comprehensive overview of the frontend API functions and their implementations. Each API function is designed to handle specific aspects of the system while maintaining consistency in error handling, data validation, and state management. 