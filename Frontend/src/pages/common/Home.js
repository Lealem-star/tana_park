import React from 'react'
import { Link } from 'react-router-dom'
import '../../css/home.scss'

function Home() {
  return (
    <div>
      <div className='banner'>
        <div className='overlay'>
          <h1>Welcome to TanaPark</h1>
          <Link to="/login" className="home-login-btn">
            Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Home