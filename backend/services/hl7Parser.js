class HL7Parser {
  constructor() {
    this.segmentSeparators = {
      field: '|',
      component: '^',
      subcomponent: '&',
      repetition: '~',
      escape: '\\'
    };
  }

  parse(message) {
    try {
      const lines = message.split('\r').filter(line => line.trim());
      const parsed = {
        message: {},
        segments: {},
        metadata: {}
      };

      // Parse MSH segment (message header)
      const mshLine = lines.find(line => line.startsWith('MSH'));
      if (mshLine) {
        parsed.message.header = this.parseSegment(mshLine);
        parsed.metadata.encodingCharacters = mshLine.substring(3, 8);
        parsed.metadata.messageType = this.getMessageType(mshLine);
      }

      // Parse all segments
      lines.forEach(line => {
        const segmentType = line.substring(0, 3);
        if (!parsed.segments[segmentType]) {
          parsed.segments[segmentType] = [];
        }
        parsed.segments[segmentType].push(this.parseSegment(line));
      });

      // Extract patient information
      if (parsed.segments.PID) {
        parsed.patient = this.extractPatientInfo(parsed.segments.PID[0]);
      }

      // Extract visit information
      if (parsed.segments.PV1) {
        parsed.visit = this.extractVisitInfo(parsed.segments.PV1[0]);
      }

      // Extract observation information
      if (parsed.segments.OBX) {
        parsed.observations = parsed.segments.OBX.map(obx => this.extractObservationInfo(obx));
      }

      return parsed;
    } catch (error) {
      throw new Error(`HL7 parsing failed: ${error.message}`);
    }
  }

  parseSegment(line) {
    const fields = line.split(this.segmentSeparators.field);
    const parsed = {
      type: fields[0],
      fields: fields.slice(1)
    };

    // Parse components within fields
    parsed.fields = parsed.fields.map(field => {
      if (field.includes(this.segmentSeparators.component)) {
        return field.split(this.segmentSeparators.component);
      }
      return field;
    });

    return parsed;
  }

  getMessageType(mshLine) {
    const fields = mshLine.split(this.segmentSeparators.field);
    if (fields.length > 8) {
      const messageType = fields[8];
      if (messageType.includes(this.segmentSeparators.component)) {
        const components = messageType.split(this.segmentSeparators.component);
        return {
          event: components[0],
          type: components[1]
        };
      }
      return { event: messageType, type: '' };
    }
    return { event: '', type: '' };
  }

  extractPatientInfo(pidSegment) {
    const fields = pidSegment.fields;
    return {
      identifier: fields[0] || '',
      patientIdentifiers: Array.isArray(fields[1]) ? fields[1] : [fields[1]].filter(Boolean),
      name: this.parseName(fields[5]),
      motherMaidenName: fields[6] || '',
      birthDate: fields[7] || '',
      gender: fields[8] || '',
      address: this.parseAddress(fields[11]),
      phoneNumber: fields[13] || '',
      ethnicity: fields[22] || ''
    };
  }

  extractVisitInfo(pv1Segment) {
    const fields = pv1Segment.fields;
    return {
      patientClass: fields[2] || '',
      patientLocation: fields[3] || '',
      admissionType: fields[4] || '',
      attendingDoctor: fields[7] || '',
      referringDoctor: fields[8] || '',
      admittingDoctor: fields[9] || '',
      visitNumber: fields[19] || '',
      service: fields[10] || ''
    };
  }

  extractObservationInfo(obxSegment) {
    const fields = obxSegment.fields;
    return {
      setId: fields[1] || '',
      valueType: fields[2] || '',
      observationIdentifier: fields[3] || '',
      observationSubId: fields[4] || '',
      observationValue: fields[5] || '',
      units: fields[6] || '',
      referenceRange: fields[7] || '',
      abnormalFlags: fields[8] || '',
      probability: fields[9] || '',
      natureOfAbnormalTest: fields[10] || '',
      observationResultStatus: fields[11] || '',
      effectiveDate: fields[14] || '',
      userDefinedAccessChecks: fields[16] || ''
    };
  }

  parseName(nameField) {
    if (!nameField) return { firstName: '', lastName: '', middleName: '' };
    
    if (Array.isArray(nameField)) {
      return {
        lastName: nameField[0] || '',
        firstName: nameField[1] || '',
        middleName: nameField[2] || '',
        suffix: nameField[3] || '',
        prefix: nameField[4] || ''
      };
    }
    
    return { firstName: nameField, lastName: '', middleName: '' };
  }

  parseAddress(addressField) {
    if (!addressField) return { street: '', city: '', state: '', zip: '', country: '' };
    
    if (Array.isArray(addressField)) {
      return {
        street: addressField[0] || '',
        city: addressField[2] || '',
        state: addressField[3] || '',
        zip: addressField[4] || '',
        country: addressField[5] || ''
      };
    }
    
    return { street: addressField, city: '', state: '', zip: '', country: '' };
  }

  validateMessage(message) {
    const errors = [];
    
    if (!message) {
      errors.push('Message is empty');
      return errors;
    }

    const lines = message.split('\r').filter(line => line.trim());
    const hasMSH = lines.some(line => line.startsWith('MSH'));
    
    if (!hasMSH) {
      errors.push('Missing MSH segment (message header)');
    }

    // Check for proper field separators
    const mshLine = lines.find(line => line.startsWith('MSH'));
    if (mshLine && mshLine.length < 8) {
      errors.push('MSH segment is incomplete - missing encoding characters');
    }

    return errors;
  }
}

module.exports = { HL7Parser };
