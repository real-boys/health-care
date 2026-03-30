class FHIRConverter {
  constructor() {
    this.fhirBase = {
      resourceType: '',
      id: '',
      meta: {
        profile: []
      }
    };
  }

  convertHL7ToFHIR(hl7Data, resourceType) {
    switch (resourceType.toLowerCase()) {
      case 'patient':
        return this.convertToPatient(hl7Data);
      case 'encounter':
        return this.convertToEncounter(hl7Data);
      case 'observation':
        return this.convertToObservation(hl7Data);
      case 'diagnosticreport':
        return this.convertToDiagnosticReport(hl7Data);
      default:
        throw new Error(`Unsupported FHIR resource type: ${resourceType}`);
    }
  }

  convertToPatient(hl7Data) {
    const patient = {
      resourceType: 'Patient',
      id: this.generateId(),
      identifier: [],
      name: [],
      gender: this.mapGender(hl7Data.patient?.gender),
      birthDate: this.formatDate(hl7Data.patient?.birthDate),
      address: [],
      telecom: [],
      extension: []
    };

    // Add identifiers
    if (hl7Data.patient?.patientIdentifiers) {
      hl7Data.patient.patientIdentifiers.forEach((id, index) => {
        if (id) {
          patient.identifier.push({
            type: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: index === 0 ? 'MR' : 'PI',
                display: index === 0 ? 'Medical Record Number' : 'Patient Internal Identifier'
              }]
            },
            value: id,
            system: index === 0 ? 'urn:oid:2.16.840.1.113883.4.1' : 'urn:oid:2.16.840.1.113883.4.1'
          });
        }
      });
    }

    // Add name
    if (hl7Data.patient?.name) {
      const name = hl7Data.patient.name;
      patient.name.push({
        use: 'official',
        family: name.lastName || '',
        given: [name.firstName, name.middleName].filter(Boolean),
        prefix: name.prefix ? [name.prefix] : [],
        suffix: name.suffix ? [name.suffix] : []
      });
    }

    // Add address
    if (hl7Data.patient?.address?.street) {
      patient.address.push({
        use: 'home',
        line: [hl7Data.patient.address.street],
        city: hl7Data.patient.address.city,
        state: hl7Data.patient.address.state,
        postalCode: hl7Data.patient.address.zip,
        country: hl7Data.patient.address.country
      });
    }

    // Add telecom (phone)
    if (hl7Data.patient?.phoneNumber) {
      patient.telecom.push({
        system: 'phone',
        value: hl7Data.patient.phoneNumber,
        use: 'home'
      });
    }

    // Add ethnicity extension
    if (hl7Data.patient?.ethnicity) {
      patient.extension.push({
        url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
        extension: [{
          url: 'ombCategory',
          valueCoding: {
            system: 'urn:oid:2.16.840.1.113883.6.238',
            code: hl7Data.patient.ethnicity,
            display: this.getEthnicityDisplay(hl7Data.patient.ethnicity)
          }
        }]
      });
    }

    return patient;
  }

  convertToEncounter(hl7Data) {
    const encounter = {
      resourceType: 'Encounter',
      id: this.generateId(),
      identifier: [{
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'VN',
            display: 'Visit Number'
          }]
        },
        value: hl7Data.visit?.visitNumber || '',
        system: 'urn:oid:2.16.840.1.113883.4.1'
      }],
      status: 'finished',
      class: this.mapPatientClass(hl7Data.visit?.patientClass),
      subject: {
        reference: `Patient/${this.generateId()}`,
        display: this.getPatientDisplay(hl7Data.patient?.name)
      },
      period: {
        start: new Date().toISOString()
      },
      location: [],
      participant: []
    };

    // Add location
    if (hl7Data.visit?.patientLocation) {
      encounter.location.push({
        location: {
          display: hl7Data.visit.patientLocation
        }
      });
    }

    // Add participants (doctors)
    const participants = [
      { type: 'attending', doctor: hl7Data.visit?.attendingDoctor },
      { type: 'referring', doctor: hl7Data.visit?.referringDoctor },
      { type: 'admitting', doctor: hl7Data.visit?.admittingDoctor }
    ];

    participants.forEach(participant => {
      if (participant.doctor) {
        encounter.participant.push({
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: participant.type,
              display: `${participant.type.charAt(0).toUpperCase() + participant.type.slice(1)} physician`
            }]
          }],
          individual: {
            display: participant.doctor
          }
        });
      }
    });

    return encounter;
  }

  convertToObservation(hl7Data) {
    if (!hl7Data.observations || hl7Data.observations.length === 0) {
      throw new Error('No observation data found in HL7 message');
    }

    return hl7Data.observations.map(obs => ({
      resourceType: 'Observation',
      id: this.generateId(),
      identifier: [{
        value: obs.setId,
        system: 'urn:oid:2.16.840.1.113883.4.1'
      }],
      status: this.mapObservationStatus(obs.observationResultStatus),
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'laboratory',
          display: 'Laboratory'
        }]
      }],
      code: this.parseObservationCode(obs.observationIdentifier),
      subject: {
        reference: `Patient/${this.generateId()}`,
        display: this.getPatientDisplay(hl7Data.patient?.name)
      },
      effectiveDateTime: this.formatDate(obs.effectiveDate) || new Date().toISOString(),
      valueQuantity: obs.observationValue && !isNaN(obs.observationValue) ? {
        value: parseFloat(obs.observationValue),
        unit: obs.units || '',
        system: 'http://unitsofmeasure.org',
        code: obs.units || ''
      } : undefined,
      interpretation: obs.abnormalFlags ? [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
          code: obs.abnormalFlags,
          display: this.getInterpretationDisplay(obs.abnormalFlags)
        }]
      }] : [],
      referenceRange: obs.referenceRange ? [{
        text: obs.referenceRange
      }] : []
    }));
  }

  convertToDiagnosticReport(hl7Data) {
    return {
      resourceType: 'DiagnosticReport',
      id: this.generateId(),
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
          code: 'LAB',
          display: 'Laboratory'
        }]
      }],
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '30522-7',
          display: 'Complete blood count (CBC) panel'
        }]
      },
      subject: {
        reference: `Patient/${this.generateId()}`,
        display: this.getPatientDisplay(hl7Data.patient?.name)
      },
      effectiveDateTime: new Date().toISOString(),
      issued: new Date().toISOString(),
      result: hl7Data.observations ? hl7Data.observations.map(obs => ({
        reference: `Observation/${this.generateId()}`
      })) : []
    };
  }

  // Helper methods
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  mapGender(gender) {
    const genderMap = {
      'M': 'male',
      'F': 'female',
      'O': 'other',
      'U': 'unknown'
    };
    return genderMap[gender?.toUpperCase()] || 'unknown';
  }

  mapPatientClass(patientClass) {
    const classMap = {
      'I': { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'inpatient encounter' },
      'O': { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
      'E': { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' },
      'P': { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'PRENC', display: 'pre-admission' }
    };
    return classMap[patientClass?.toUpperCase()] || { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' };
  }

  mapObservationStatus(status) {
    const statusMap = {
      'F': 'final',
      'P': 'preliminary',
      'C': 'corrected',
      'X': 'cancelled'
    };
    return statusMap[status?.toUpperCase()] || 'final';
  }

  parseObservationCode(identifier) {
    // This is a simplified parser - in practice, you'd parse the full CE/CNE format
    return {
      coding: [{
        system: 'http://loinc.org',
        code: identifier || '',
        display: identifier || ''
      }],
      text: identifier || ''
    };
  }

  getPatientDisplay(name) {
    if (!name) return 'Unknown Patient';
    return `${name.firstName || ''} ${name.lastName || ''}`.trim() || 'Unknown Patient';
  }

  getEthnicityDisplay(code) {
    const ethnicityMap = {
      'H': 'Hispanic or Latino',
      'N': 'Not Hispanic or Latino'
    };
    return ethnicityMap[code] || code;
  }

  getInterpretationDisplay(code) {
    const interpretationMap = {
      'H': 'High',
      'L': 'Low',
      'N': 'Normal',
      'A': 'Abnormal',
      'HH': 'Critically High',
      'LL': 'Critically Low'
    };
    return interpretationMap[code] || code;
  }

  formatDate(dateString) {
    if (!dateString) return null;
    // HL7 format: YYYYMMDDHHMMSS
    if (dateString.length >= 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    return dateString;
  }
}

module.exports = { FHIRConverter };
