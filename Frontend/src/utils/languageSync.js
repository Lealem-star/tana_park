import i18n from '../i18n/config';

/**
 * Syncs i18n language with user's language preference
 * @param {string} userLanguage - User's language preference ('en' or 'am')
 */
export const syncLanguageWithUser = (userLanguage) => {
    if (userLanguage && ['en', 'am'].includes(userLanguage)) {
        i18n.changeLanguage(userLanguage);
        localStorage.setItem('i18nextLng', userLanguage);
    }
};

/**
 * Gets the current language from i18n
 * @returns {string} Current language code
 */
export const getCurrentLanguage = () => {
    return i18n.language || 'en';
};

