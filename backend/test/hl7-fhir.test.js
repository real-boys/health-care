const request = require('supertest');
const { app } = require('../server');
const { HL7Parser } = require('../services/hl7Parser');
const { FHIRConverter } = require('../services/fhirConverter');

describe('HL7/FHIR Integration API', () => {
  let authToken;
  
  beforeAll(async () => {
    // Setup authentication token for testing
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    authToken = loginResponse.body.token;
  });

  describe('HL7 Parser', () => {
    const hl7Parser = new HL7Parser();
    
    test('should parse ADT message correctly', () => {
      const adtMessage = `MSH|^~\\&|EPIC|HOSPITAL|LAB|LAB|202312011200||ADT^A01|123456|P|2.5
PID|1||12345^^^HOSPITAL^MR||DOE^JOHN^A||19700101|M||123 MAIN ST^^ANYTOWN^NY^12345||(555)555-5555||S`;
      
      const parsed = hl7Parser.parse(adtMessage);
      
      expect(parsed.message.header.type).toBe('MSH');
      expect(parsed.patient.name.firstName).toBe('JOHN');
      expect(parsed.patient.name.lastName).toBe('DOE');
      expect(parsed.patient.gender).toBe('M');
      expect(parsed.patient.birthDate).toBe('19700101');
    });

    test('should parse ORU message with observations', () => {
      const oruMessage = `MSH|^~\\&|LAB|HOSPITAL|EPIC|EPIC|202312011200||ORU^R01|123457|P|2.5
PID|1||12345^^^HOSPITAL^MR||DOE^JOHN^A||19700101|M
OBX|1|NM|GLU^Glucose||105|mg/dL|70-105|N||F|202312011200`;
      
      const parsed = hl7Parser.parse(oruMessage);
      
      expect(parsed.observations).toHaveLength(1);
      expect(parsed.observations[0].observationIdentifier).toBe('GLU^Glucose');
      expect(parsed.observations[0].observationValue).toBe('105');
      expect(parsed.observations[0].units).toBe('mg/dL');
    });

    test('should validate HL7 message format', () => {
      const validMessage = 'MSH|^~\\&|EPIC|HOSPITAL|LAB|LAB|202312011200||ADT^A01|123456|P|2.5';
      const invalidMessage = 'INVALID|MESSAGE|FORMAT';
      
      expect(hl7Parser.validateMessage(validMessage)).toEqual([]);
      expect(hl7Parser.validateMessage(invalidMessage).length).toBeGreaterThan(0);
    });
  });

  describe('FHIR Converter', () => {
    const fhirConverter = new FHIRConverter();
    
    test('should convert HL7 patient data to FHIR Patient resource', () => {
      const hl7Data = {
        patient: {
          patientIdentifiers: ['12345'],
          name: { firstName: 'JOHN', lastName: 'DOE' },
          birthDate: '19700101',
          gender: 'M',
          address: { street: '123 MAIN ST', city: 'ANYTOWN', state: 'NY', zip: '12345' },
          phoneNumber: '(555)555-5555'
        }
      };
      
      const fhirPatient = fhirConverter.convertToPatient(hl7Data);
      
      expect(fhirPatient.resourceType).toBe('Patient');
      expect(fhirPatient.name[0].given[0]).toBe('JOHN');
      expect(fhirPatient.name[0].family).toBe('DOE');
      expect(fhirPatient.gender).toBe('male');
      expect(fhirPatient.birthDate).toBe('1970-01-01');
      expect(fhirPatient.telecom[0].value).toBe('(555)555-5555');
    });

    test('should convert HL7 encounter data to FHIR Encounter resource', () => {
      const hl7Data = {
        visit: {
          visitNumber: 'V123456',
          patientClass: 'I',
          patientLocation: 'ED^ROOM1',
          attendingDoctor: 'Dr. Smith',
          service: 'Emergency'
        },
        patient: {
          name: { firstName: 'JOHN', lastName: 'DOE' }
        }
      };
      
      const fhirEncounter = fhirConverter.convertToEncounter(hl7Data);
      
      expect(fhirEncounter.resourceType).toBe('Encounter');
      expect(fhirEncounter.class.code).toBe('IMP');
      expect(fhirEncounter.status).toBe('finished');
      expect(fhirEncounter.location[0].location.display).toBe('ED^ROOM1');
    });

    test('should convert HL7 observations to FHIR Observation resources', () => {
      const hl7Data = {
        observations: [
          {
            setId: '1',
            observationIdentifier: 'GLU^Glucose',
            observationValue: '105',
            units: 'mg/dL',
            abnormalFlags: 'N',
            observationResultStatus: 'F',
            effectiveDate: '202312011200'
          }
        ],
        patient: {
          name: { firstName: 'JOHN', lastName: 'DOE' }
        }
      };
      
      const fhirObservations = fhirConverter.convertToObservation(hl7Data);
      
      expect(Array.isArray(fhirObservations)).toBe(true);
      expect(fhirObservations[0].resourceType).toBe('Observation');
      expect(fhirObservations[0].valueQuantity.value).toBe(105);
      expect(fhirObservations[0].valueQuantity.unit).toBe('mg/dL');
      expect(fhirObservations[0].status).toBe('final');
    });
  });

  describe('Integration API Endpoints', () => {
    test('POST /api/hl7-fhir/parse-hl7 should parse HL7 message', async () => {
      const hl7Message = `MSH|^~\\&|EPIC|HOSPITAL|LAB|LAB|202312011200||ADT^A01|123456|P|2.5
PID|1||12345^^^HOSPITAL^MR||DOE^JOHN^A||19700101|M`;
      
      const response = await request(app)
        .post('/api/hl7-fhir/parse-hl7')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: hl7Message })
        .expect(200);
      
      expect(response.body.patient.name.firstName).toBe('JOHN');
      expect(response.body.patient.name.lastName).toBe('DOE');
    });

    test('POST /api/hl7-fhir/convert-hl7-to-fhir should convert to FHIR', async () => {
      const hl7Message = `MSH|^~\\&|EPIC|HOSPITAL|LAB|LAB|202312011200||ADT^A01|123456|P|2.5
PID|1||12345^^^HOSPITAL^MR||DOE^JOHN^A||19700101|M`;
      
      const response = await request(app)
        .post('/api/hl7-fhir/convert-hl7-to-fhir')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          hl7Message: hl7Message,
          resourceType: 'patient'
        })
        .expect(200);
      
      expect(response.body.resourceType).toBe('Patient');
      expect(response.body.name[0].given[0]).toBe('JOHN');
    });

    test('GET /api/hl7-fhir/configs should return integration configs', async () => {
      const response = await request(app)
        .get('/api/hl7-fhir/configs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/hl7-fhir/configs should create new config', async () => {
      const newConfig = {
        name: 'Test Integration',
        type: 'HL7',
        description: 'Test configuration',
        connectionConfig: {
          host: 'test.local',
          port: 2575
        },
        mappingConfig: {
          patient: {
            'PID.5': 'name'
          }
        },
        syncFrequency: 'DAILY'
      };
      
      const response = await request(app)
        .post('/api/hl7-fhir/configs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newConfig)
        .expect(201);
      
      expect(response.body.name).toBe('Test Integration');
      expect(response.body.type).toBe('HL7');
    });

    test('GET /api/hl7-fhir/sync-status should return sync status', async () => {
      const response = await request(app)
        .get('/api/hl7-fhir/sync-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/hl7-fhir/test-connection should test connection', async () => {
      const testConfig = {
        host: 'test.local',
        port: 2575,
        protocol: 'MLLP'
      };
      
      const response = await request(app)
        .post('/api/hl7-fhir/test-connection')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ config: testConfig })
        .expect(200);
      
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });

    test('POST /api/hl7-fhir/preview-transformation should show preview', async () => {
      const sourceData = {
        patientName: 'JOHN DOE',
        birthDate: '19700101',
        gender: 'M'
      };
      
      const mappingConfig = {
        'patientName': 'name',
        'birthDate': 'birthDate',
        'gender': 'gender'
      };
      
      const response = await request(app)
        .post('/api/hl7-fhir/preview-transformation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sourceData,
          mappingConfig
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('originalData');
      expect(response.body).toHaveProperty('transformedData');
      expect(response.body).toHaveProperty('mappingApplied');
    });

    test('GET /api/hl7-fhir/health should return health status', async () => {
      const response = await request(app)
        .get('/api/hl7-fhir/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('connections');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid HL7 message gracefully', async () => {
      const response = await request(app)
        .post('/api/hl7-fhir/parse-hl7')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'invalid message' })
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
    });

    test('should handle unsupported FHIR resource type', async () => {
      const response = await request(app)
        .post('/api/hl7-fhir/convert-hl7-to-fhir')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          hl7Message: 'MSH|^~\\&|TEST|TEST|TEST|TEST|202312011200||ADT^A01|123456|P|2.5',
          resourceType: 'unsupported'
        })
        .expect(500);
      
      expect(response.body.error).toContain('Unsupported FHIR resource type');
    });

    test('should require authentication for protected endpoints', async () => {
      await request(app)
        .get('/api/hl7-fhir/configs')
        .expect(401);
      
      await request(app)
        .post('/api/hl7-fhir/parse-hl7')
        .send({ message: 'test' })
        .expect(401);
    });
  });
});
