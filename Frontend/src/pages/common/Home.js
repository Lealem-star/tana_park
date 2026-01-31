import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import '../../css/home.scss'

function Home() {
  const { t } = useTranslation();
  return (
    <div>
      <div className='banner'>
        <div className='overlay'>
          <h1>{t('common.welcome')} to TanaPark</h1>
          <Link to="/login" className="home-login-btn">
            {t('common.login')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Home