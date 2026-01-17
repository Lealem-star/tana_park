import React, { useState, useEffect } from 'react';
// Using habesha-datepicker which has better export support
import EtDatePicker from 'habesha-datepicker';
import { EtLocalizationProvider } from 'habesha-datepicker';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import './EthiopianDatePicker.scss';

// Create a theme that works with Bootstrap styling
const theme = createTheme({
  palette: {
    primary: {
      main: '#0d6efd', // Bootstrap primary blue
    },
  },
});

/**
 * EthiopianDatePicker Component
 * A wrapper around habesha-datepicker that handles Ethiopian calendar dates
 * 
 * Props:
 * - value: Date string in YYYY-MM-DD format (Gregorian) - for API compatibility
 * - onChange: Callback function that receives the date in YYYY-MM-DD format (Gregorian)
 * - label: Label text for the date picker
 * - className: Additional CSS classes
 * - disabled: Whether the picker is disabled
 * - minDate: Minimum selectable date (Date object or string YYYY-MM-DD)
 * - maxDate: Maximum selectable date (Date object or string YYYY-MM-DD)
 */
const EthiopianDatePicker = ({ 
  value, 
  onChange, 
  label = 'Select Date', 
  className = '',
  disabled = false,
  minDate,
  maxDate
}) => {
  // Convert YYYY-MM-DD string to Date object for the picker
  const [selectedDate, setSelectedDate] = useState(() => {
    if (value) {
      return new Date(value);
    }
    return null;
  });

  // Update when value prop changes
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    
    // Convert Date object back to YYYY-MM-DD format for API compatibility
    if (newDate && onChange) {
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      onChange(formattedDate);
    } else if (onChange) {
      onChange('');
    }
  };

  // Convert minDate/maxDate if they're strings
  const getMinDate = () => {
    if (!minDate) return undefined;
    return typeof minDate === 'string' ? new Date(minDate) : minDate;
  };

  const getMaxDate = () => {
    if (!maxDate) return undefined;
    return typeof maxDate === 'string' ? new Date(maxDate) : maxDate;
  };

  // Build props object conditionally to avoid passing undefined to DOM
  const etDatePickerProps = {
    label,
    value: selectedDate,
    onChange: handleDateChange,
    disabled,
  };

  // Only add minDate/maxDate if they are defined
  const computedMinDate = getMinDate();
  const computedMaxDate = getMaxDate();
  
  if (computedMinDate !== undefined) {
    etDatePickerProps.minDate = computedMinDate;
  }
  
  if (computedMaxDate !== undefined) {
    etDatePickerProps.maxDate = computedMaxDate;
  }

  return (
    <ThemeProvider theme={theme}>
      <EtLocalizationProvider localType="EC">
        <div className={`ethiopian-date-picker-wrapper ${className}`}>
          <EtDatePicker {...etDatePickerProps} />
        </div>
      </EtLocalizationProvider>
    </ThemeProvider>
  );
};

export default EthiopianDatePicker;

