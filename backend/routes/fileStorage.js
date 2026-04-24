

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {

    });
  }
});

module.exports = router;
