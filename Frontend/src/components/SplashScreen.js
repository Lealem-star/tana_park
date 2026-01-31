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

    // Generate random cars for animation
    const carTypes = ['tripod', 'automobile', 'truck', 'trailer'];
    const [cars] = useState(() => {
        const carArray = [];
        for (let i = 0; i < 12; i++) {
            carArray.push({
                id: i,
                type: carTypes[Math.floor(Math.random() * carTypes.length)],
                delay: Math.random() * 10,
                duration: 8 + Math.random() * 4,
                direction: Math.random() > 0.5 ? 'left' : 'right',
                top: 10 + Math.random() * 80
            });
        }
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
                        <div className="car-body">
                            <div className="car-window"></div>
                            {car.type === 'truck' && <div className="car-cargo"></div>}
                            {car.type === 'trailer' && (
                                <>
                                    <div className="car-cargo"></div>
                                    <div className="car-trailer"></div>
                                </>
                            )}
                        </div>
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

