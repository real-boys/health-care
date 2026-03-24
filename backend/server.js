const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const medicalRecordsRoutes = require('./routes/medicalRecords');
<

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Handle audit alert subscriptions
  socket.on('subscribe_audit_alerts', (data) => {
    const { alertTypes = [], severities = [] } = data;
    if (auditMonitoringService) {
      auditMonitoringService.subscribeToAlerts(socket, alertTypes, severities);
    }
  });

  socket.on('unsubscribe_audit_alerts', () => {
    if (auditMonitoringService) {
      auditMonitoringService.unsubscribeFromAlerts(socket.id);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await initializeDatabase();

    // Initialize audit monitoring service
    auditMonitoringService = new AuditMonitoringService(io);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/api/health`);
      console.log(`HL7/FHIR API available at http://localhost:${PORT}/api/hl7-fhir`);
      console.log(`Audit API available at http://localhost:${PORT}/api/audit`);
      console.log('Real-time audit monitoring enabled');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
