const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class TelemedicineService {
  constructor(io) {
    this.io = io;
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Telemedicine Service connected to database');
        resolve();
      });
    });
  }

  // Appointment Management
  async createAppointment(patientId, providerId, appointmentDate, durationMinutes = 30, notes = '') {
    return new Promise((resolve, reject) => {
      const roomId = uuidv4();
      const query = `
        INSERT INTO telemedicine_appointments 
        (patient_id, provider_id, appointment_date, duration_minutes, status, room_id, notes)
        VALUES (?, ?, ?, ?, 'scheduled', ?, ?)
      `;
      
      this.db.run(query, [patientId, providerId, appointmentDate, durationMinutes, roomId, notes], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, roomId });
      });
    });
  }

  async getAppointments(userId, role = 'patient') {
    return new Promise((resolve, reject) => {
      const field = role === 'patient' ? 'patient_id' : 'provider_id';
      const query = `SELECT * FROM telemedicine_appointments WHERE ${field} = ? ORDER BY appointment_date DESC`;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async updateAppointmentStatus(appointmentId, status) {
    return new Promise((resolve, reject) => {
      const query = `UPDATE telemedicine_appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      
      this.db.run(query, [status, appointmentId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ updated: true });
      });
    });
  }

  // Prescription Management
  async createPrescription(appointmentId, patientId, providerId, medicationName, dosage, frequency, instructions, expiryDate) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO telemedicine_prescriptions 
        (appointment_id, patient_id, provider_id, medication_name, dosage, frequency, instructions, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [appointmentId, patientId, providerId, medicationName, dosage, frequency, instructions, expiryDate], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID });
      });
    });
  }

  async getPrescriptions(patientId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM telemedicine_prescriptions WHERE patient_id = ? ORDER BY created_at DESC`;
      
      this.db.all(query, [patientId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // Remote Monitoring
  async recordMetric(patientId, metricType, metricValue, metricUnit, source = 'manual') {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO telemedicine_remote_monitoring 
        (patient_id, metric_type, metric_value, metric_unit, source)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [patientId, metricType, metricValue, metricUnit, source], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID });
      });
    });
  }

  async getMetrics(patientId, metricType = null) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM telemedicine_remote_monitoring WHERE patient_id = ?`;
      const params = [patientId];
      
      if (metricType) {
        query += ` AND metric_type = ?`;
        params.push(metricType);
      }
      
      query += ` ORDER BY recorded_at DESC LIMIT 100`;
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // WebRTC Signaling Helpers
  handleSignaling(socket) {
    socket.on('join-consultation', (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-joined', socket.id);
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('signal', (data) => {
      socket.to(data.roomId).emit('signal', {
        signal: data.signal,
        from: socket.id
      });
    });

    socket.on('leave-consultation', (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit('user-left', socket.id);
      console.log(`User ${socket.id} left room ${roomId}`);
    });
    
    // Virtual Lobby logic
    socket.on('enter-lobby', (providerId) => {
      socket.join(`lobby-${providerId}`);
      this.io.to(`provider-${providerId}`).emit('patient-waiting', {
        socketId: socket.id,
        timestamp: new Date()
      });
    });
  }
}

module.exports = TelemedicineService;
