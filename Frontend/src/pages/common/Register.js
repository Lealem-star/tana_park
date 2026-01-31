import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { register } from '../../api/api'
import '../../css/auth.scss'

const Register = () => {
    const { t } = useTranslation();
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [type, setType] = useState('')

    const [isRegistered, setIsRegistered] = useState(false)
    const [error, setError] = useState()

    const handleRegister = () => {
        setIsRegistered(false)
        setError()
        register({ name, email, password, type, handleRegisterSuccess, handleRegisterFailure })
    }

    const handleRegisterSuccess = () => {
        setIsRegistered(true)
    }

    const handleRegisterFailure = (error) => {
        
        setError(error)
    }

    return (
        <div className='auth-container'>
            <div className='card login-card m-auto p-5'>
                <h3 className='mb-4'>{t('auth.signUp')}</h3>
                <div className="alert alert-info" role="alert">
                    {t('auth.registrationDisabled')}
                </div>
                {isRegistered && <div className="alert alert-success" role="alert">
                    {t('auth.registrationSuccessful')}
                </div>}
                {error && <div className="alert alert-danger" role="alert">
                    {error}
                </div>}
                <div className="mb-3">
                    <label htmlFor="name" className="form-label">{t('auth.name')}</label>
                    <input type="name" className="form-control" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="mb-3">
                    <label htmlFor="email" className="form-label">{t('auth.email')}</label>
                    <input type="email" className="form-control" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="mb-3">
                    <label htmlFor="password" className="form-label">{t('auth.password')}</label>
                    <input type="password" className="form-control" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="mb-3">
                    <label htmlFor="password" className="form-label">{t('auth.type')}</label>
                    <select className="form-select" value={type} onChange={(e) => setType(e.target.value)} required>
                        <option value="">{t('auth.select')}</option>
                        <option value="valet">{t('admin.valet')}</option>
                    </select>
                </div>
                <div className='d-flex justify-content-between'>
                    {t('auth.existingUser')}<Link to='/login'>{t('auth.signIn')}</Link>
                </div>
                <button type="submit" className="btn btn-outline-primary mt-3" onClick={() => handleRegister()}>{t('common.submit')}</button>
            </div>
        </div>
    )
}

export default Register