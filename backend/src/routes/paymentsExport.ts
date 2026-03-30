import express from 'express';
import jwt from 'jsonwebtoken';
import { exportService } from '../services/exportService';
import { dateValidator } from '../utils/dateValidator';

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user is admin
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Main export endpoint
router.get('/export', authenticateToken, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const { format, startDate, endDate, userId } = req.query;
    
    // Validate format
    if (!format || !['csv', 'pdf', 'json'].includes(format as string)) {
      return res.status(400).json({ 
        error: 'Invalid format. Supported formats: csv, pdf, json' 
      });
    }
    
    // Check if user is admin and trying to export another user's data
    const isAdmin = req.user.role === 'admin';
    const targetUserId = isAdmin ? (userId as string) || req.user.id : req.user.id;
    
    // If admin is trying to export another user's data, validate the userId
    if (isAdmin && userId && userId !== req.user.id) {
      // In a real implementation, you'd validate that the target user exists
      // For now, we'll just proceed
    }
    
    // Generate export
    const exportResult = await exportService.exportPayments({
      format: format as 'csv' | 'pdf' | 'json',
      startDate: startDate as string,
      endDate: endDate as string,
      userId: req.user.id,
      isAdmin,
      targetUserId
    });
    
    // Log the export
    await exportService.logExport(
      req.user.id,
      format as string,
      exportResult.filename,
      exportResult.recordCount,
      startDate as string,
      endDate as string
    );
    
    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('X-Record-Count', exportResult.recordCount.toString());
    
    // Send the file
    if (Buffer.isBuffer(exportResult.data)) {
      res.send(exportResult.data);
    } else {
      res.send(exportResult.data);
    }
    
  } catch (error) {
    console.error('Export error:', error);
    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// Get export history for current user
router.get('/export/history', authenticateToken, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const history = await exportService.getExportHistory(req.user.id, isAdmin);
    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('Export history error:', error);
    next(error);
  }
});

// Get export presets (common date ranges)
router.get('/export/presets', authenticateToken, (req: express.Request, res: express.Response) => {
  try {
    const presets = dateValidator.getDateRangePresets();
    res.json({
      success: true,
      presets
    });
  } catch (error) {
    console.error('Export presets error:', error);
    res.status(500).json({ error: 'Failed to get export presets' });
  }
});

// Admin endpoint: Get export statistics
router.get('/export/stats', authenticateToken, requireAdmin, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    // This would typically query a database for export statistics
    // For now, we'll return mock data
    const stats = {
      totalExports: 0,
      exportsByFormat: {
        csv: 0,
        pdf: 0,
        json: 0
      },
      exportsByUser: {},
      recentExports: [],
      averageRecordCount: 0
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Export stats error:', error);
    next(error);
  }
});

// Validate export parameters before actual export
router.post('/export/validate', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { format, startDate, endDate, userId } = req.body;
    
    // Validate format
    if (!format || !['csv', 'pdf', 'json'].includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format. Supported formats: csv, pdf, json' 
      });
    }
    
    // Validate date range
    const dateValidation = dateValidator.validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      return res.status(400).json({ 
        error: dateValidation.error 
      });
    }
    
    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const targetUserId = isAdmin ? userId || req.user.id : req.user.id;
    
    if (!isAdmin && userId && userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'You can only export your own payment history' 
      });
    }
    
    // Return validation success with estimated record count
    // In a real implementation, you'd query the database for the actual count
    const estimatedCount = 0; // Placeholder
    
    res.json({
      success: true,
      validation: {
        valid: true,
        estimatedRecordCount: estimatedCount,
        dateRange: {
          startDate: dateValidation.startDate,
          endDate: dateValidation.endDate
        }
      }
    });
    
  } catch (error) {
    console.error('Export validation error:', error);
    res.status(500).json({ error: 'Failed to validate export parameters' });
  }
});

// Get available export formats with descriptions
router.get('/export/formats', authenticateToken, (req: express.Request, res: express.Response) => {
  const formats = {
    csv: {
      name: 'CSV (Comma Separated Values)',
      description: 'Export payment data as a CSV file compatible with Excel and spreadsheet applications',
      mimeType: 'text/csv',
      fileExtension: '.csv',
      features: [
        'Compatible with Excel',
        'Easy data analysis',
        'Portable format',
        'UTF-8 encoding'
      ]
    },
    pdf: {
      name: 'PDF (Portable Document Format)',
      description: 'Generate a formatted PDF report with branding and summary statistics',
      mimeType: 'application/pdf',
      fileExtension: '.pdf',
      features: [
        'Professional formatting',
        'Includes summary statistics',
        'Printable format',
        'Branded header'
      ]
    },
    json: {
      name: 'JSON (JavaScript Object Notation)',
      description: 'Export raw payment data in JSON format for developers and APIs',
      mimeType: 'application/json',
      fileExtension: '.json',
      features: [
        'Machine readable',
        'Complete data structure',
        'API friendly',
        'Pretty printed'
      ]
    }
  };
  
  res.json({
    success: true,
    formats
  });
});

export default router;
