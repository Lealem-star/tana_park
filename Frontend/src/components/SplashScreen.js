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

    useEffect(() => {
        // Check if splash was already shown in this session
        const splashShown = sessionStorage.getItem('splashShown');
        if (splashShown === 'true') {
            onComplete();
            return;
        }

        // Animation sequence
        const timeline = setTimeout(() => {
            // Logo appears
            setLogoVisible(true);
        }, 1000);

        const text1Timer = setTimeout(() => {
            setText1Visible(true);
        }, 800);

        const text2Timer = setTimeout(() => {
            setText2Visible(true);
        }, 1800);

        const fadeOutTimer = setTimeout(() => {
            setIsVisible(false);
        }, 3500);

        const completeTimer = setTimeout(() => {
            sessionStorage.setItem('splashShown', 'true');
            onComplete();
        }, 4000);

        return () => {
            clearTimeout(timeline);
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

