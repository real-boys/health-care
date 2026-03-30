const express = require('express');
const router = express.Router();
const TelemedicineService = require('../services/telemedicineService');

module.exports = (io) => {
  const telemedicineService = new TelemedicineService(io);
  telemedicineService.initialize();

  // Appointment Routes
  router.post('/appointments', async (req, res) => {
    try {
      const { patientId, providerId, appointmentDate, durationMinutes, notes } = req.body;
      const result = await telemedicineService.createAppointment(patientId, providerId, appointmentDate, durationMinutes, notes);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/appointments/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.query;
      const result = await telemedicineService.getAppointments(userId, role);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch('/appointments/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await telemedicineService.updateAppointmentStatus(id, status);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Prescription Routes
  router.post('/prescriptions', async (req, res) => {
    try {
      const { appointmentId, patientId, providerId, medicationName, dosage, frequency, instructions, expiryDate } = req.body;
      const result = await telemedicineService.createPrescription(appointmentId, patientId, providerId, medicationName, dosage, frequency, instructions, expiryDate);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/prescriptions/:patientId', async (req, res) => {
    try {
      const { patientId } = req.params;
      const result = await telemedicineService.getPrescriptions(patientId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remote Monitoring Routes
  router.post('/metrics', async (req, res) => {
    try {
      const { patientId, metricType, metricValue, metricUnit, source } = req.body;
      const result = await telemedicineService.recordMetric(patientId, metricType, metricValue, metricUnit, source);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/metrics/:patientId', async (req, res) => {
    try {
      const { patientId } = req.params;
      const { type } = req.query;
      const result = await telemedicineService.getMetrics(patientId, type);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Signaling Socket Attachment (optional inside router if needed, 
  // but better handled in server.js directly using telemedicineService.handleSignaling)
  
  return router;
};
