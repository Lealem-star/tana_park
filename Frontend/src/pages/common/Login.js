import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { login } from '../../api/api'
import { setUser } from '../../reducers/userReducer'
import '../../css/auth.scss'

const Login = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch();

    const [phoneNumber, setPhoneNumber] = useState('')
    const [password, setPassword] = useState('')

    const [error, setError] = useState()

    // Login API call with callback functions for handling response
    const handleLogin = () => {
        login({ phoneNumber, password, handleLoginSuccess, handleLoginFailure })
    }

    const handleLoginSuccess = (data) => {
        dispatch(setUser({ ...data?.user, token: data?.token }));
        // Redirect based on user type
        if (data?.user?.type === 'system_admin') {
            navigate('/admin/dashboard');
        } else if (data?.user?.type === 'valet') {
            navigate('/valet/dashboard');
        } else {
            navigate('/');
        }
    }

    const handleLoginFailure = (error) => {
        setError(error?.message || error?.error || 'Failed to login')
    }

    return (
        <div className='container-fluid auth-container'>
            <div className='card login-card m-auto p-5'>
                <h3 className='mb-4'>Sign in</h3>
                {error && <div className="alert alert-danger" role="alert">
                    {error}
                </div>}
                <div className="mb-3">
                    <label htmlFor="phoneNumber" className="form-label">Phone Number</label>
                    <input type="text" className="form-control" id="phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
                </div>
                <div className="mb-3">
                    <label htmlFor="pass" className="form-label">Password</label>
                    <input type="password" className="form-control" id="pass" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {/* <div className='d-flex justify-content-between'>
                    Are you a new user?<Link to='/register'>Create account</Link>
                </div> */}
                <button type="submit" className="btn btn-outline-primary mt-3" onClick={() => handleLogin()}>Submit</button>
            </div>
        </div>
    )
}

export default Login