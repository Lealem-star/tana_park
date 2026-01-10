import React from 'react'
import '../../css/about.scss'

const About = () => {
    return (
        <div>
            <div className='container'>
                <div className='row py-5 my-5'>
                    <h2 className='mb-3'>About Us</h2>
                    <p>TanaPark is a platform designed to help parking valets manage their services efficiently within the community.</p>
                </div>

                <div className='row mt-5'>
                    <div className='col-md-6 d-flex align-items-center'>
                        <div className='text-right'>
                            <h3>Parking Valet</h3>
                            <p>The TanaPark web application offers a professional service for parking valets from the community. Our platform provides tools for efficient management and communication. Our user-friendly interface ensures a seamless experience for valets to manage their services effectively.</p>
                        </div>
                    </div>
                    <div className='col-md-6'>
                        <img src='./owner.jpg' className='services-img' alt="parking valet"></img>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default About