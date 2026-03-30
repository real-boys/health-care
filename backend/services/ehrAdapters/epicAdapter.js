const axios = require('axios');

/**
 * Epic EHR Integration Adapter
 * Handles integration with Epic Systems via FHIR R4 and proprietary APIs
 */
class EpicAdapter {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.EPIC_FHIR_BASE_URL;
    this.clientId = config.clientId || process.env.EPIC_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.EPIC_CLIENT_SECRET;
    this.tokenUrl = config.tokenUrl || `${this.baseUrl}/oauth2/token`;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get OAuth2 access token using SMART on FHIR flow
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'launch patient/Patient.read patient/Observation.read patient/Condition.read patient/MedicationRequest.read'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      
      return this.accessToken;
    } catch (error) {
      throw new Error(`Epic token retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient demographics from Epic
   */
  async getPatient(patientId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/Patient/${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return this.transformEpicPatient(response.data);
    } catch (error) {
      throw new Error(`Epic patient retrieval failed: ${error.message}`);
    }
  }

  /**
   * Search for patients by criteria
   */
  async searchPatients(params) {
    try {
      const token = await this.getAccessToken();
      const queryParams = new URLSearchParams(params);
      
      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/Patient?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        total: response.data.total,
        patients: response.data.entry?.map(entry => this.transformEpicPatient(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Epic patient search failed: ${error.message}`);
    }
  }

  /**
   * Get patient observations (vitals, labs, etc.)
   */
  async getObservations(patientId, params = {}) {
    try {
      const token = await this.getAccessToken();
      const queryParams = new URLSearchParams({
        patient: patientId,
        ...params
      });

      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/Observation?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        total: response.data.total,
        observations: response.data.entry?.map(entry => this.transformObservation(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Epic observation retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient conditions (problems, diagnoses)
   */
  async getConditions(patientId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/Condition?patient=${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        total: response.data.total,
        conditions: response.data.entry?.map(entry => this.transformCondition(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Epic condition retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient medications
   */
  async getMedications(patientId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/MedicationRequest?patient=${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        total: response.data.total,
        medications: response.data.entry?.map(entry => this.transformMedication(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Epic medication retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient allergies
   */
  async getAllergies(patientId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/AllergyIntolerance?patient=${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        total: response.data.total,
        allergies: response.data.entry?.map(entry => this.transformAllergy(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Epic allergy retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient immunizations
   */
  async getImmunizations(patientId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/Immunization?patient=${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        total: response.data.total,
        immunizations: response.data.entry?.map(entry => this.transformImmunization(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Epic immunization retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient encounters (visits)
   */
  async getEncounters(patientId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/Encounter?patient=${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        total: response.data.total,
        encounters: response.data.entry?.map(entry => this.transformEncounter(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Epic encounter retrieval failed: ${error.message}`);
    }
  }

  /**
   * Transform Epic Patient resource to standard format
   */
  transformEpicPatient(patientResource) {
    return {
      id: patientResource.id,
      mrn: patientResource.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value,
      firstName: patientResource.name?.[0]?.given?.[0],
      lastName: patientResource.name?.[0]?.family,
      dateOfBirth: patientResource.birthDate,
      gender: patientResource.gender,
      address: patientResource.address?.[0],
      telecom: patientResource.telecom,
      contact: patientResource.contact,
      generalPractitioner: patientResource.generalPractitioner,
      managingOrganization: patientResource.managingOrganization,
      active: patientResource.active
    };
  }

  /**
   * Transform Observation resource
   */
  transformObservation(observationResource) {
    return {
      id: observationResource.id,
      status: observationResource.status,
      category: observationResource.category?.[0]?.coding?.[0]?.display,
      code: observationResource.code?.text || observationResource.code?.coding?.[0]?.display,
      value: observationResource.valueQuantity?.value || 
             observationResource.valueString || 
             observationResource.valueCodeableConcept?.text,
      unit: observationResource.valueQuantity?.unit,
      effectiveDate: observationResource.effectiveDateTime,
      referenceRange: observationResource.referenceRange,
      performer: observationResource.performer
    };
  }

  /**
   * Transform Condition resource
   */
  transformCondition(conditionResource) {
    return {
      id: conditionResource.id,
      clinicalStatus: conditionResource.clinicalStatus?.text || 
                      conditionResource.clinicalStatus?.coding?.[0]?.display,
      verificationStatus: conditionResource.verificationStatus?.text,
      category: conditionResource.category?.[0]?.coding?.[0]?.display,
      code: conditionResource.code?.text || conditionResource.code?.coding?.[0]?.display,
      onsetDate: conditionResource.onsetDateTime || conditionResource.onsetAge?.value,
      recordedDate: conditionResource.recordedDate,
      recorder: conditionResource.recorder
    };
  }

  /**
   * Transform MedicationRequest resource
   */
  transformMedication(medicationResource) {
    return {
      id: medicationResource.id,
      status: medicationResource.status,
      intent: medicationResource.intent,
      medication: medicationResource.medicationCodeableConcept?.text || 
                  medicationResource.medicationCodeableConcept?.coding?.[0]?.display,
      dosage: medicationResource.dosageInstruction?.[0]?.text,
      frequency: medicationResource.dosageInstruction?.[0]?.timing?.repeat?.frequency,
      period: medicationResource.dosageInstruction?.[0]?.timing?.repeat?.period,
      periodUnit: medicationResource.dosageInstruction?.[0]?.timing?.repeat?.periodUnit,
      authoredOn: medicationResource.authoredOn,
      requester: medicationResource.requester,
      dispenseRequest: medicationResource.dispenseRequest
    };
  }

  /**
   * Transform AllergyIntolerance resource
   */
  transformAllergy(allergyResource) {
    return {
      id: allergyResource.id,
      clinicalStatus: allergyResource.clinicalStatus?.text,
      verificationStatus: allergyResource.verificationStatus?.text,
      type: allergyResource.type,
      category: allergyResource.category,
      criticality: allergyResource.criticality,
      code: allergyResource.code?.text || allergyResource.code?.coding?.[0]?.display,
      onsetDate: allergyResource.onsetDateTime,
      recordedDate: allergyResource.recordedDate,
      reaction: allergyResource.reaction?.map(r => ({
        substance: r.substance?.text,
        manifestation: r.manifestation?.map(m => m.text),
        severity: r.severity
      }))
    };
  }

  /**
   * Transform Immunization resource
   */
  transformImmunization(immunizationResource) {
    return {
      id: immunizationResource.id,
      status: immunizationResource.status,
      vaccineCode: immunizationResource.vaccineCode?.text || 
                    immunizationResource.vaccineCode?.coding?.[0]?.display,
      patient: immunizationResource.patient?.reference,
      occurrenceDate: immunizationResource.occurrenceDateTime,
      primarySource: immunizationResource.primarySource,
      lotNumber: immunizationResource.lotNumber,
      expirationDate: immunizationResource.expirationDate,
      site: immunizationResource.protocolApplied?.[0]?.targetDisease?.[0]?.coding?.[0]?.display,
      route: immunizationResource.route?.text,
      doseQuantity: immunizationResource.protocolApplied?.[0]?.doseSequence
    };
  }

  /**
   * Transform Encounter resource
   */
  transformEncounter(encounterResource) {
    return {
      id: encounterResource.id,
      status: encounterResource.status,
      class: encounterResource.class?.display,
      type: encounterResource.type?.map(t => t.text || t.coding?.[0]?.display),
      priority: encounterResource.priority?.text,
      subject: encounterResource.subject?.reference,
      participant: encounterResource.participant?.map(p => ({
        type: p.type?.[0]?.text,
        individual: p.individual?.reference
      })),
      period: encounterResource.period,
      reason: encounterResource.reasonCode?.map(r => r.text),
      diagnosis: encounterResource.diagnosis?.map(d => ({
        condition: d.condition?.reference,
        use: d.use?.text,
        rank: d.rank
      })),
      location: encounterResource.location?.map(l => ({
        location: l.location?.reference,
        status: l.status
      }))
    };
  }

  /**
   * Test connection to Epic
   */
  async testConnection() {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.baseUrl}/metadata`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          timeout: 5000
        }
      );

      return {
        success: true,
        system: 'Epic',
        fhirVersion: response.data?.fhirVersion,
        softwareName: response.data?.software?.name,
        softwareVersion: response.data?.software?.version,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        system: 'Epic',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = { EpicAdapter };
