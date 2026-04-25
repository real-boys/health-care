const axios = require('axios');

/**
 * Cerner (Oracle Health) EHR Integration Adapter
 * Handles integration with Cerner via FHIR R4 and proprietary APIs
 */
class CernerAdapter {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.CERNER_FHIR_BASE_URL;
    this.clientId = config.clientId || process.env.CERNER_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.CERNER_CLIENT_SECRET;
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
          scope: 'launch patient/Patient.read patient/Observation.read patient/Condition.read patient/MedicationRequest.read patient/AllergyIntolerance.read'
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
      throw new Error(`Cerner token retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient demographics from Cerner
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

      return this.transformCernerPatient(response.data);
    } catch (error) {
      throw new Error(`Cerner patient retrieval failed: ${error.message}`);
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
        patients: response.data.entry?.map(entry => this.transformCernerPatient(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Cerner patient search failed: ${error.message}`);
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
      throw new Error(`Cerner observation retrieval failed: ${error.message}`);
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
      throw new Error(`Cerner condition retrieval failed: ${error.message}`);
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
      throw new Error(`Cerner medication retrieval failed: ${error.message}`);
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
      throw new Error(`Cerner allergy retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient procedures
   */
  async getProcedures(patientId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/Procedure?patient=${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        total: response.data.total,
        procedures: response.data.entry?.map(entry => this.transformProcedure(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Cerner procedure retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient diagnostic reports (lab results, imaging)
   */
  async getDiagnosticReports(patientId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/fhir/r4/DiagnosticReport?patient=${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        total: response.data.total,
        reports: response.data.entry?.map(entry => this.transformDiagnosticReport(entry.resource)) || []
      };
    } catch (error) {
      throw new Error(`Cerner diagnostic report retrieval failed: ${error.message}`);
    }
  }

  /**
   * Transform Cerner Patient resource to standard format
   */
  transformCernerPatient(patientResource) {
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
      active: patientResource.active,
      deceasedBoolean: patientResource.deceasedBoolean,
      deceasedDateTime: patientResource.deceasedDateTime,
      maritalStatus: patientResource.maritalStatus?.text,
      multipleBirthBoolean: patientResource.multipleBirthBoolean,
      communication: patientResource.communication
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
      referenceRange: observationResource.referenceRange?.map(range => ({
        low: range.low?.value,
        high: range.high?.value,
        text: range.text
      })),
      performer: observationResource.performer,
      component: observationResource.component?.map(comp => ({
        code: comp.code?.text || comp.code?.coding?.[0]?.display,
        value: comp.valueQuantity?.value || comp.valueString
      }))
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
      severity: conditionResource.severity?.text || conditionResource.severity?.coding?.[0]?.display,
      code: conditionResource.code?.text || conditionResource.code?.coding?.[0]?.display,
      bodySite: conditionResource.bodySite?.map(site => site.text || site.coding?.[0]?.display),
      onsetDate: conditionResource.onsetDateTime || conditionResource.onsetAge?.value,
      abatementDate: conditionResource.abatementDateTime,
      recordedDate: conditionResource.recordedDate,
      recorder: conditionResource.recorder,
      asserter: conditionResource.asserter,
      stage: conditionResource.stage?.map(s => ({
        summary: s.summary?.text,
        assessment: s.assessment?.map(a => a.reference)
      })),
      evidence: conditionResource.evidence?.map(e => ({
        code: e.code?.map(c => c.text)
      }))
    };
  }

  /**
   * Transform MedicationRequest resource
   */
  transformMedication(medicationResource) {
    return {
      id: medicationResource.id,
      identifier: medicationResource.identifier?.map(id => id.value),
      status: medicationResource.status,
      statusReason: medicationResource.statusReason?.text,
      intent: medicationResource.intent,
      category: medicationResource.category?.[0]?.coding?.[0]?.display,
      priority: medicationResource.priority,
      doNotPerform: medicationResource.doNotPerform,
      reportedBoolean: medicationResource.reportedBoolean,
      medication: medicationResource.medicationCodeableConcept?.text || 
                  medicationResource.medicationCodeableConcept?.coding?.[0]?.display,
      subject: medicationResource.subject?.reference,
      encounter: medicationResource.encounter?.reference,
      authoredOn: medicationResource.authoredOn,
      requester: medicationResource.requester?.reference,
      performer: medicationResource.performer?.map(p => p.reference),
      performerType: medicationResource.performerType?.text,
      reasonCode: medicationResource.reasonCode?.map(r => r.text),
      dosageInstruction: medicationResource.dosageInstruction?.map(d => ({
        sequence: d.sequence,
        text: d.text,
        timing: d.timing?.repeat ? {
          frequency: d.timing.repeat.frequency,
          period: d.timing.repeat.period,
          periodUnit: d.timing.repeat.periodUnit,
          boundsDuration: d.timing.repeat.boundsDuration
        } : null,
        route: d.route?.text,
        method: d.method?.text,
        doseAndRate: d.doseAndRate?.map(dr => ({
          type: dr.type?.text,
          doseQuantity: dr.doseQuantity?.value
        }))
      })),
      dispenseRequest: medicationResource.dispenseRequest ? {
        validityPeriod: medicationResource.dispenseRequest.validityPeriod,
        numberOfRepeatsAllowed: medicationResource.dispenseRequest.numberOfRepeatsAllowed,
        quantity: medicationResource.dispenseRequest.quantity?.value,
        expectedSupplyDuration: medicationResource.dispenseRequest.expectedSupplyDuration?.value
      } : null,
      substitution: medicationResource.substitution ? {
        allowedBoolean: medicationResource.substitution.allowedBoolean,
        reason: medicationResource.substitution.reason?.text
      } : null
    };
  }

  /**
   * Transform AllergyIntolerance resource
   */
  transformAllergy(allergyResource) {
    return {
      id: allergyResource.id,
      identifier: allergyResource.identifier?.map(id => id.value),
      clinicalStatus: allergyResource.clinicalStatus?.text,
      verificationStatus: allergyResource.verificationStatus?.text,
      type: allergyResource.type,
      category: allergyResource.category,
      criticality: allergyResource.criticality,
      code: allergyResource.code?.text || allergyResource.code?.coding?.[0]?.display,
      patient: allergyResource.patient?.reference,
      encounter: allergyResource.encounter?.reference,
      onsetDate: allergyResource.onsetDateTime,
      recordedDate: allergyResource.recordedDate,
      recorder: allergyResource.recorder?.reference,
      asserter: allergyResource.asserter?.reference,
      lastOccurrence: allergyResource.lastOccurrence,
      note: allergyResource.note?.map(n => n.text),
      reaction: allergyResource.reaction?.map(r => ({
        substance: r.substance?.text,
        manifestation: r.manifestation?.map(m => m.text),
        description: r.description?.text,
        onset: r.onset,
        severity: r.severity,
        exposureRoute: r.exposureRoute?.text,
        note: r.note?.map(n => n.text)
      }))
    };
  }

  /**
   * Transform Procedure resource
   */
  transformProcedure(procedureResource) {
    return {
      id: procedureResource.id,
      identifier: procedureResource.identifier?.map(id => id.value),
      status: procedureResource.status,
      statusReason: procedureResource.statusReason?.text,
      category: procedureResource.category?.text,
      code: procedureResource.code?.text || procedureResource.code?.coding?.[0]?.display,
      subject: procedureResource.subject?.reference,
      encounter: procedureResource.encounter?.reference,
      performedDateTime: procedureResource.performedDateTime,
      performedPeriod: procedureResource.performedPeriod,
      performer: procedureResource.performer?.map(p => ({
        function: p.function?.text,
        actor: p.actor?.reference
      })),
      location: procedureResource.location?.reference,
      reasonCode: procedureResource.reasonCode?.map(r => r.text),
      reasonReference: procedureResource.reasonReference?.map(r => r.reference),
      bodySite: procedureResource.bodySite?.map(site => site.text || site.coding?.[0]?.display),
      outcome: procedureResource.outcome?.text,
      report: procedureResource.report?.map(r => r.reference),
      complication: procedureResource.complication?.map(c => c.text),
      followUp: procedureResource.followUp?.map(f => f.text),
      note: procedureResource.note?.map(n => n.text)
    };
  }

  /**
   * Transform DiagnosticReport resource
   */
  transformDiagnosticReport(reportResource) {
    return {
      id: reportResource.id,
      identifier: reportResource.identifier?.map(id => id.value),
      basedOn: reportResource.basedOn?.map(b => b.reference),
      status: reportResource.status,
      category: reportResource.category?.[0]?.coding?.[0]?.display,
      code: reportResource.code?.text || reportResource.code?.coding?.[0]?.display,
      subject: reportResource.subject?.reference,
      encounter: reportResource.encounter?.reference,
      effectiveDateTime: reportResource.effectiveDateTime,
      issued: reportResource.issued,
      performer: reportResource.performer?.map(p => p.reference),
      resultsInterpreter: reportResource.resultsInterpreter?.map(p => p.reference),
      specimen: reportResource.specimen?.map(s => s.reference),
      result: reportResource.result?.map(r => r.reference),
      imagingStudy: reportResource.imagingStudy?.map(i => i.reference),
      media: reportResource.media?.map(m => ({
        comment: m.comment,
        link: m.link?.reference
      })),
      conclusion: reportResource.conclusion,
      conclusionCode: reportResource.conclusionCode?.map(c => c.text),
      presentedForm: reportResource.presentedForm?.map(f => ({
        contentType: f.contentType,
        language: f.language,
        data: f.data,
        url: f.url,
        size: f.size,
        title: f.title
      }))
    };
  }

  /**
   * Test connection to Cerner
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
        system: 'Cerner',
        fhirVersion: response.data?.fhirVersion,
        softwareName: response.data?.software?.name,
        softwareVersion: response.data?.software?.version,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        system: 'Cerner',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = { CernerAdapter };
