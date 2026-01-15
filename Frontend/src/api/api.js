import axios from 'axios'
const BASE_URL_RAW = process.env.REACT_APP_BASE_URL || "http://localhost:4000/";
const BASE_URL = BASE_URL_RAW.endsWith('/') ? BASE_URL_RAW : `${BASE_URL_RAW}/`;

export const login = async ({ phoneNumber, password, handleLoginSuccess, handleLoginFailure }) => {
    try {
        const result = await axios.post(`${BASE_URL}user/login`, { phoneNumber, password })
        if (result?.data?.token) {
            return handleLoginSuccess(result.data)
        }
        console.log('login ', result);
    } catch (error) {
        console.error('login error:', error);
        console.error('login error response:', error?.response?.data);
        console.error('login error status:', error?.response?.status);
        console.error('login request data:', { phoneNumber, password: '***' });
        // Extract error message from various possible formats
        const errorMessage = error?.response?.data?.error || 
                           error?.response?.data?.message || 
                           error?.message || 
                           'Failed to login';
        console.error('login error message:', errorMessage);
        handleLoginFailure(errorMessage)
    }
}

export const register = async ({ name, email, password, type, handleRegisterSuccess, handleRegisterFailure }) => {
    try {
        const result = await axios.post(`${BASE_URL}user/register`, {
            name,
            email,
            password,
            type
        })
        if (result?.data?.name) {
            return handleRegisterSuccess()
        }
        console.log('register ', result);
        handleRegisterFailure('Registration failed')
    } catch (error) {
        console.error('register ', error);
        handleRegisterFailure(error?.response?.data?.error)
    }
}

export const resetPassword = async ({ user_id, body, handleResetPasswordSuccess, handleResetPasswordFailure }) => {
    try {
        console.log('body ', body);
        const result = await axios.post(`${BASE_URL}user/resetPassword/${user_id}`, { ...body })
        console.log('resetPassword ', result?.data);
        if (result?.data?.user) {
            return handleResetPasswordSuccess(result.data)
        }
    } catch (error) {
        console.error('resetPassword ', error);
        handleResetPasswordFailure(error?.response?.data?.error)
    }
}

export const updateUser = async ({ user_id, body, handleUpdateUserSuccess, handleUpdateUserFailure }) => {
    try {
        console.log('body ', body);
        const result = await axios.put(`${BASE_URL}user/${user_id}`, { ...body })
        console.log('updateUser ', result?.data);
        if (result?.data?.user) {
            return handleUpdateUserSuccess(result.data)
        }
    } catch (error) {
        console.error('updateUser ', error);
        handleUpdateUserFailure(error?.response?.data?.error)
    }
}

export const uploadProfilePhoto = async ({ user_id, file, handleUploadSuccess, handleUploadFailure }) => {
    try {
        const formData = new FormData();
        formData.append('profilePhoto', file);

        const token = localStorage.getItem('token');
        const result = await axios.post(`${BASE_URL}user/${user_id}/upload-photo`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('uploadProfilePhoto ', result?.data);
        if (result?.data?.user) {
            return handleUploadSuccess(result.data);
        }
    } catch (error) {
        console.error('uploadProfilePhoto ', error);
        handleUploadFailure(error?.response?.data?.error || 'Failed to upload profile photo');
    }
}

export const fetchUsers = async ({ setUsers }) => {
    try {
        const result = await axios.get(`${BASE_URL}user`)
        if (result?.data?.length) {
            setUsers(result?.data)
        }
        console.log('fetchUsers ', result);
    } catch (error) {
        console.error('fetchUsers ', error);
    }
}

export const deleteUser = async ({ id, handleDeleteUserSuccess, handleDeleteUserFailure }) => {
    try {
        console.log(`URL >> ${BASE_URL}user/delete/${id}`);
        const result = await axios.delete(`${BASE_URL}user/delete/${id}`)
        if (result?.data?.message) {
            return handleDeleteUserSuccess(result.message)
        }
        console.log('deleteUser ', result);
    } catch (error) {
        console.error('deleteUser ', error);
        handleDeleteUserFailure(error?.response?.data?.error)
    }
}

export const createUser = async ({ body, token, handleCreateUserSuccess, handleCreateUserFailure }) => {
    try {
        console.log('createUser request body:', { ...body, password: '***' });
        const result = await axios.post(`${BASE_URL}user/create`, { ...body }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        if (result?.data?.user) {
            return handleCreateUserSuccess(result.data)
        }
        console.log('createUser response:', result?.data);
    } catch (error) {
        console.error('createUser error:', error);
        console.error('createUser error response:', error?.response?.data);
        const errorMessage = error?.response?.data?.error || error?.message || 'Failed to create user';
        handleCreateUserFailure(errorMessage)
    }
}

// Parked Car API functions
export const createParkedCar = async ({ body, token, handleCreateParkedCarSuccess, handleCreateParkedCarFailure }) => {
    try {
        const result = await axios.post(`${BASE_URL}parkedCar`, { ...body }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        if (result?.data?.car) {
            return handleCreateParkedCarSuccess(result.data)
        }
        console.log('createParkedCar ', result);
    } catch (error) {
        console.error('createParkedCar ', error);
        handleCreateParkedCarFailure(error?.response?.data?.error)
    }
}

export const fetchParkedCars = async ({ token, status, date, setParkedCars }) => {
    try {
        let query = '';
        const params = [];
        if (status) params.push(`status=${status}`);
        if (date) params.push(`date=${date}`);
        if (params.length > 0) query = '?' + params.join('&');

        const result = await axios.get(`${BASE_URL}parkedCar${query}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        if (result?.data) {
            setParkedCars(result.data)
        }
        console.log('fetchParkedCars ', result);
    } catch (error) {
        console.error('fetchParkedCars ', error);
    }
}

export const updateParkedCar = async ({ id, body, token, handleUpdateParkedCarSuccess, handleUpdateParkedCarFailure }) => {
    try {
        const result = await axios.put(`${BASE_URL}parkedCar/${id}`, { ...body }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        if (result?.data?.car) {
            return handleUpdateParkedCarSuccess(result.data)
        }
        console.log('updateParkedCar ', result);
    } catch (error) {
        console.error('updateParkedCar ', error);
        handleUpdateParkedCarFailure(error?.response?.data?.error)
    }
}

export const deleteParkedCar = async ({ id, token, handleDeleteParkedCarSuccess, handleDeleteParkedCarFailure }) => {
    try {
        const result = await axios.delete(`${BASE_URL}parkedCar/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        if (result?.data?.message) {
            return handleDeleteParkedCarSuccess(result.data)
        }
        console.log('deleteParkedCar ', result);
    } catch (error) {
        console.error('deleteParkedCar ', error);
        handleDeleteParkedCarFailure(error?.response?.data?.error)
    }
}

export const sendSmsNotification = async ({ phoneNumber, message, token, handleSendSmsSuccess, handleSendSmsFailure }) => {
    try {
        const result = await axios.post(`${BASE_URL}sms/send`, { phoneNumber, message }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (result?.data?.success) {
            handleSendSmsSuccess(result.data);
        } else {
            handleSendSmsFailure(result?.data?.message || 'Failed to send SMS');
        }
    } catch (error) {
        console.error('sendSmsNotification error:', error);
        handleSendSmsFailure(error?.response?.data?.error || 'Failed to send SMS');
    }
};

// Chapa Payment API functions
export const initializeChapaPayment = async ({ carId, amount, customerName, customerEmail, customerPhone, token, handleInitSuccess, handleInitFailure }) => {
    try {
        const result = await axios.post(`${BASE_URL}payment/chapa/initialize`, {
            carId,
            amount,
            customerName,
            customerEmail,
            customerPhone
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (result?.data?.success) {
            handleInitSuccess(result.data);
        } else {
            handleInitFailure(result?.data?.error || 'Failed to initialize payment');
        }
    } catch (error) {
        console.error('initializeChapaPayment error:', error);
        // Extract error message - handle both string and object errors
        let errorMessage = 'Failed to initialize payment';
        if (error?.response?.data?.error) {
            errorMessage = typeof error.response.data.error === 'string' 
                ? error.response.data.error 
                : JSON.stringify(error.response.data.error);
        } else if (error?.message) {
            errorMessage = error.message;
        }
        handleInitFailure(errorMessage);
    }
};

export const verifyChapaPayment = async ({ txRef, token, handleVerifySuccess, handleVerifyFailure }) => {
    try {
        const result = await axios.get(`${BASE_URL}payment/chapa/verify/${txRef}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (result?.data?.success) {
            handleVerifySuccess(result.data);
        } else {
            handleVerifyFailure(result?.data?.error || 'Failed to verify payment');
        }
    } catch (error) {
        console.error('verifyChapaPayment error:', error);
        handleVerifyFailure(error?.response?.data?.error || 'Failed to verify payment');
    }
};

export const fetchDailyStats = async ({ token, date, setDailyStats }) => {
    try {
        // Build URL with optional date query param
        const url = date 
            ? `${BASE_URL}parkedCar/stats/daily?date=${date}` 
            : `${BASE_URL}parkedCar/stats/daily`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        if (response.data) {
            setDailyStats(response.data);
        }
    } catch (error) {
        console.error("Error fetching daily stats:", error);
        setDailyStats({ // Reset to default on error
            totalParked: 0,
            checkedOut: 0,
            stillParked: 0,
            manualPayments: 0,
            onlinePayments: 0,
        });
    }
};

export const fetchDailyStatsHistory = async ({ token, limit = 10, setDailyStatsHistory }) => {
    try {
        const response = await axios.get(`${BASE_URL}parkedCar/stats/daily/history?limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        if (response.data) {
            setDailyStatsHistory(response.data);
        }
    } catch (error) {
        console.error("Error fetching daily stats history:", error);
        setDailyStatsHistory([]);
    }
};

export const fetchPricingSettings = async ({ setPricingSettings }) => {
    try {
        const response = await axios.get(`${BASE_URL}pricingSettings`);
        if (response.data) {
            setPricingSettings(response.data);
        }
    } catch (error) {
        console.error("Error fetching pricing settings:", error);
        setPricingSettings({});
    }
};

export const updatePricingSettings = async ({ settings, token, handleUpdateSuccess, handleUpdateFailure }) => {
    try {
        const response = await axios.put(`${BASE_URL}pricingSettings`, { settings }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.data) {
            handleUpdateSuccess(response.data);
        }
    } catch (error) {
        console.error("Error updating pricing settings:", error);
        const errorMessage = error?.response?.data?.error || 'Failed to update pricing settings';
        handleUpdateFailure(errorMessage);
    }
};