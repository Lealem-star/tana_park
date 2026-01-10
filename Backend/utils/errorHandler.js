const handleError = (error, res) => {
  console.log("Error - ",error);
  const status = error.status || 500;
  res.status(status);
  res.json({ 
    error: error.message || 'Internal server error',
    message: error.message || 'Internal server error'
  });
}

module.exports = handleError;