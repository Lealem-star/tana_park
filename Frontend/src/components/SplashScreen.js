import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import bahirDarLogo from '../img/image.png';
import '../css/splashScreen.scss';

const SplashScreen = ({ onComplete }) => {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(true);
    const [logoVisible, setLogoVisible] = useState(false);
    const [text1Visible, setText1Visible] = useState(false);
    const [text2Visible, setText2Visible] = useState(false);

    const renderVehicleSvg = (type) => {
        switch (type) {
            case 'truck':
                return (
                    <svg className="vehicle-svg" viewBox="0 0 120 50" aria-hidden="true">
                        {/* cargo */}
                        <rect x="5" y="10" width="70" height="25" rx="4" />
                        {/* cab */}
                        <path d="M78 18 h18 l10 10 v7 h-28 z" />
                        {/* window */}
                        <rect className="vehicle-window" x="85" y="21" width="10" height="7" rx="1.5" />
                        {/* wheels */}
                        <circle className="vehicle-wheel" cx="25" cy="38" r="6" />
                        <circle className="vehicle-wheel" cx="60" cy="38" r="6" />
                        <circle className="vehicle-wheel" cx="92" cy="38" r="6" />
                    </svg>
                );
            case 'trailer':
                return (
                    <svg className="vehicle-svg" viewBox="0 0 160 50" aria-hidden="true">
                        {/* trailer box */}
                        <rect x="5" y="10" width="85" height="25" rx="4" />
                        {/* connector */}
                        <rect x="92" y="27" width="10" height="3" rx="1.5" />
                        {/* cab */}
                        <path d="M105 18 h18 l10 10 v7 h-28 z" />
                        <rect className="vehicle-window" x="112" y="21" width="10" height="7" rx="1.5" />
                        {/* wheels */}
                        <circle className="vehicle-wheel" cx="25" cy="38" r="6" />
                        <circle className="vehicle-wheel" cx="70" cy="38" r="6" />
                        <circle className="vehicle-wheel" cx="125" cy="38" r="6" />
                    </svg>
                );
            case 'tripod':
                // small "motorbike" like silhouette (for tripod)
                return (
                    <svg className="vehicle-svg" viewBox="0 0 120 50" aria-hidden="true">
                        <path d="M30 30 h25 l10 -10 h15 l8 8 h-12 l-8 8 h-20 z" />
                        <rect className="vehicle-window" x="66" y="17" width="10" height="6" rx="1.5" />
                        <circle className="vehicle-wheel" cx="35" cy="38" r="6" />
                        <circle className="vehicle-wheel" cx="85" cy="38" r="6" />
                    </svg>
                );
            case 'automobile':
            default:
                return (
                    <svg className="vehicle-svg" viewBox="0 0 120 50" aria-hidden="true">
                        {/* body */}
                        <path d="M20 30 h70 l10 0 c6 0 10 4 10 8 v2 H20 v-2 c0-4 3-8 10-8z" />
                        {/* roof */}
                        <path d="M35 30 l10-10 h30 l12 10 z" />
                        {/* windows */}
                        <path className="vehicle-window" d="M48 22 h12 l6 6 H44 z" />
                        <path className="vehicle-window" d="M68 22 h12 l6 6 H64 z" />
                        {/* wheels */}
                        <circle className="vehicle-wheel" cx="40" cy="40" r="6" />
                        <circle className="vehicle-wheel" cx="85" cy="40" r="6" />
                    </svg>
                );
        }
    };

    // Generate more realistic "traffic" style cars for animation
    const carTypes = ['tripod', 'automobile', 'truck', 'trailer'];
    const [cars] = useState(() => {
        // Define horizontal lanes near the bottom of the screen,
        // with fixed directions to look like cars are driving on roads.
        const lanes = [
            { id: 0, direction: 'right', top: 68 },
            { id: 1, direction: 'left', top: 74 },
            { id: 2, direction: 'right', top: 80 },
            { id: 3, direction: 'left', top: 86 },
        ];

        const carArray = [];

        lanes.forEach((lane) => {
            const carsInLane = 4; // cars per lane
            for (let i = 0; i < carsInLane; i++) {
                carArray.push({
                    id: lane.id * 10 + i,
                    type: carTypes[Math.floor(Math.random() * carTypes.length)],
                    // Stagger start times so cars follow each other like traffic
                    delay: i * 2 + Math.random(),
                    // Similar speed per lane with small variation
                    duration: 10 + Math.random() * 3,
                    direction: lane.direction,
                    // Keep cars tightly in their lane with tiny vertical jitter
                    top: lane.top + (Math.random() * 2 - 1),
                });
            }
        });

        return carArray;
    });

    useEffect(() => {
        // Check if splash was already shown in this session
        const splashShown = sessionStorage.getItem('splashShown');
        if (splashShown === 'true') {
            onComplete();
            return;
        }

        // Animation sequence - updated to 1 minute (60 seconds)
        const logoTimer = setTimeout(() => {
            setLogoVisible(true);
        }, 1000);

        const text1Timer = setTimeout(() => {
            setText1Visible(true);
        }, 2000);

        const text2Timer = setTimeout(() => {
            setText2Visible(true);
        }, 3000);

        const fadeOutTimer = setTimeout(() => {
            setIsVisible(false);
        }, 29000); // Start fade out at 29 seconds

        const completeTimer = setTimeout(() => {
            sessionStorage.setItem('splashShown', 'true');
            onComplete();
        }, 30000); // Complete at 30 seconds

        return () => {
            clearTimeout(logoTimer);
            clearTimeout(text1Timer);
            clearTimeout(text2Timer);
            clearTimeout(fadeOutTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete]);

    if (!isVisible) {
        return null;
    }

    return (
        <div className="splash-screen">
            {/* Animated Cars Background */}
            <div className="cars-container">
                {cars.map((car) => (
                    <div
                        key={car.id}
                        className={`car car-${car.type} car-${car.direction}`}
                        style={{
                            top: `${car.top}%`,
                            animationDelay: `${car.delay}s`,
                            animationDuration: `${car.duration}s`
                        }}
                    >
                        {renderVehicleSvg(car.type)}
                    </div>
                ))}
            </div>

            <div className="splash-content">
                {/* Logo with scale and fade animation */}
                <div className={`splash-logo ${logoVisible ? 'visible' : ''}`}>
                    <img src={bahirDarLogo} alt="Bahir Dar City Administration" />
                </div>

                {/* Text 1: Powered by */}
                <div className={`splash-text text-1 ${text1Visible ? 'visible' : ''}`}>
                    <p>{t('splash.poweredBy')}</p>
                </div>

                {/* Text 2: Developed by */}
                <div className={`splash-text text-2 ${text2Visible ? 'visible' : ''}`}>
                    <p>{t('splash.developedBy')}</p>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;

