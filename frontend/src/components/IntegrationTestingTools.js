import React, { useState, useEffect } from 'react';
import {
  Play,
  FileText,
  Eye,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Zap,
  Clock,
  BarChart3
} from 'lucide-react';

const IntegrationTestingTools = () => {
  const [activeTab, setActiveTab] = useState('hl7-parser');
  const [hl7Message, setHl7Message] = useState('');
  const [fhirResource, setFhirResource] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testHistory, setTestHistory] = useState([]);
  const [loadTestConfig, setLoadTestConfig] = useState({
    concurrentRequests: 10,
    duration: 60,
    messageInterval: 1000
  });
  const [loadTestResults, setLoadTestResults] = useState(null);

  // Sample HL7 message for testing
  const sampleHL7Message = `MSH|^~\\&|EPIC|HOSPITAL|LAB|LAB|20240115120000||ORM^O01|123456|P|2.5
PID|1||12345^^^HOSPITAL^MR||DOE^JOHN^A||19700101|M|||123 MAIN ST^^ANYTOWN^NY^12345||(555)555-1234|||S|C|123456789
PV1|1|I|ER^^^1^1||||123456^SMITH^JOHN^A^^MD||||||||ADM|A0|||||||||||||||||||HOSPITAL||20240115120000
ORC|NW|123456|123456|SC||CM|^^^20240115120000||||||LAB||20240115120000
OBR|1|123456|123456|CBC^COMPLETE BLOOD COUNT||20240115120000|||||||||123456^SMITH^JOHN^A^^MD^^^^^UPIN|||||||F||^^^LAB
OBX|1|NM|WBC^WHITE BLOOD COUNT||7.5|K/uL|4.5-11.0||||F|||20240115120000
OBX|2|NM|RBC^RED BLOOD COUNT||4.5|M/uL|4.0-5.5||||F|||20240115120000
OBX|3|NM|HEMOGLOBIN||14.0|g/dL|12.0-16.0||||F|||20240115120000`;

  // Sample FHIR resource for testing
  const sampleFHIRResource = {
    "resourceType": "Patient",
    "id": "example",
    "identifier": [
      {
        "type": {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
              "code": "MR",
              "display": "Medical Record Number"
            }
          ]
        },
        "value": "12345",
        "system": "urn:oid:2.16.840.1.113883.4.1"
      }
    ],
    "name": [
      {
        "use": "official",
        "family": "Doe",
        "given": ["John", "A"]
      }
    ],
    "gender": "male",
    "birthDate": "1970-01-01",
    "address": [
      {
        "use": "home",
        "line": ["123 Main St"],
        "city": "Anytown",
        "state": "NY",
        "postalCode": "12345"
      }
    ],
    "telecom": [
      {
        "system": "phone",
        "value": "(555)555-1234",
        "use": "home"
      }
    ]
  };

  useEffect(() => {
    setHl7Message(sampleHL7Message);
    setFhirResource(JSON.stringify(sampleFHIRResource, null, 2));
    
    // Load test history
    setTestHistory([
      {
        id: 1,
        type: 'HL7 Parser',
        timestamp: '2024-01-15T10:30:00Z',
        status: 'success',
        duration: 125,
        details: 'Parsed ADT^A04 message successfully'
      },
      {
        id: 2,
        type: 'FHIR Validator',
        timestamp: '2024-01-15T10:25:00Z',
        status: 'failed',
        duration: 89,
        details: 'Invalid resource type: "Patint" (should be "Patient")'
      },
      {
        id: 3,
        type: 'Transformation',
        timestamp: '2024-01-15T10:20:00Z',
        status: 'success',
        duration: 245,
        details: 'HL7 to FHIR transformation completed'
      }
    ]);
  }, []);

  const handleParseHL7 = async () => {
    if (!hl7Message.trim()) {
      alert('Please enter an HL7 message to parse');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = {
        success: true,
        data: {
          message: {
            header: {
              messageType: 'ORM^O01',
              messageControlId: '123456',
              processingId: 'P',
              versionId: '2.5'
            },
            segments: {
              'PID': [
                {
                  fields: ['1', '12345^^^HOSPITAL^MR', 'DOE^JOHN^A', '19700101', 'M']
                }
              ],
              'PV1': [
                {
                  fields: ['1', 'I', 'ER^^^1^1', '123456^SMITH^JOHN^A^^MD']
                }
              ]
            }
          },
          patient: {
            identifier: '12345',
            name: { firstName: 'JOHN', lastName: 'DOE' },
            birthDate: '19700101',
            gender: 'M'
          }
        },
        metadata: {
          segmentCount: 8,
          messageType: 'ORM^O01',
          parsedAt: new Date().toISOString()
        }
      };

      setTestResults(result);
      
      // Add to history
      const newHistoryItem = {
        id: Date.now(),
        type: 'HL7 Parser',
        timestamp: new Date().toISOString(),
        status: 'success',
        duration: 1250,
        details: `Parsed ${result.data.message.header.messageType} message successfully`
      };
      setTestHistory([newHistoryItem, ...testHistory.slice(0, 9)]);
      
    } catch (error) {
      setTestResults({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidateFHIR = async () => {
    if (!fhirResource.trim()) {
      alert('Please enter a FHIR resource to validate');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      let parsedResource;
      try {
        parsedResource = JSON.parse(fhirResource);
      } catch (e) {
        throw new Error('Invalid JSON format');
      }

      // Simulate validation
      const validation = {
        valid: true,
        errors: [],
        warnings: []
      };

      if (!parsedResource.resourceType) {
        validation.valid = false;
        validation.errors.push('Missing resourceType field');
      }

      if (parsedResource.resourceType === 'Patient') {
        if (!parsedResource.name || parsedResource.name.length === 0) {
          validation.warnings.push('Patient has no name specified');
        }
        if (!parsedResource.gender) {
          validation.warnings.push('Patient has no gender specified');
        }
      }

      const result = {
        success: validation.valid,
        data: {
          resource: parsedResource,
          validation: validation
        },
        metadata: {
          resourceType: parsedResource.resourceType,
          validatedAt: new Date().toISOString()
        }
      };

      setTestResults(result);
      
      // Add to history
      const newHistoryItem = {
        id: Date.now(),
        type: 'FHIR Validator',
        timestamp: new Date().toISOString(),
        status: validation.valid ? 'success' : 'failed',
        duration: 800,
        details: validation.valid ? 
          `${parsedResource.resourceType} resource is valid` : 
          `Validation failed: ${validation.errors.join(', ')}`
      };
      setTestHistory([newHistoryItem, ...testHistory.slice(0, 9)]);
      
    } catch (error) {
      setTestResults({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransformData = async () => {
    if (!hl7Message.trim()) {
      alert('Please enter an HL7 message to transform');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const result = {
        success: true,
        data: {
          original: sampleHL7Message,
          transformed: {
            resourceType: 'Bundle',
            id: 'transformation-result',
            type: 'collection',
            entry: [
              {
                resource: {
                  resourceType: 'Patient',
                  id: 'patient-1',
                  identifier: [{ value: '12345' }],
                  name: [{ family: 'DOE', given: ['JOHN', 'A'] }],
                  gender: 'male',
                  birthDate: '1970-01-01'
                }
              },
              {
                resource: {
                  resourceType: 'Encounter',
                  id: 'encounter-1',
                  status: 'finished',
                  class: { code: 'IMP' },
                  subject: { reference: 'Patient/patient-1' }
                }
              }
            ]
          },
          mappings: [
            { source: 'PID.3', target: 'Patient.identifier', transformation: 'Direct mapping' },
            { source: 'PID.5', target: 'Patient.name', transformation: 'Parse name components' },
            { source: 'PID.7', target: 'Patient.birthDate', transformation: 'Format date' },
            { source: 'PID.8', target: 'Patient.gender', transformation: 'Map gender' }
          ]
        },
        metadata: {
          transformationTime: new Date().toISOString(),
          resourceCount: 2
        }
      };

      setTestResults(result);
      
      // Add to history
      const newHistoryItem = {
        id: Date.now(),
        type: 'Transformation',
        timestamp: new Date().toISOString(),
        status: 'success',
        duration: 1500,
        details: `Transformed HL7 to FHIR Bundle with ${result.data.resourceCount} resources`
      };
      setTestHistory([newHistoryItem, ...testHistory.slice(0, 9)]);
      
    } catch (error) {
      setTestResults({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTest = async () => {
    setLoading(true);
    try {
      // Simulate load test
      const startTime = Date.now();
      const requests = [];
      const results = [];
      
      for (let i = 0; i < loadTestConfig.concurrentRequests; i++) {
        requests.push(
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                requestId: i + 1,
                success: Math.random() > 0.1, // 90% success rate
                duration: Math.floor(Math.random() * 500) + 100
              });
            }, Math.random() * 1000);
          })
        );
      }
      
      const testResults = await Promise.all(requests);
      const endTime = Date.now();
      
      const successful = testResults.filter(r => r.success).length;
      const failed = testResults.length - successful;
      const avgDuration = testResults.reduce((sum, r) => sum + r.duration, 0) / testResults.length;
      
      setLoadTestResults({
        totalRequests: testResults.length,
        successful,
        failed,
        successRate: (successful / testResults.length * 100).toFixed(1),
        averageDuration: avgDuration.toFixed(0),
        totalDuration: endTime - startTime,
        requestsPerSecond: (testResults.length / ((endTime - startTime) / 1000)).toFixed(1)
      });
      
    } catch (error) {
      console.error('Load test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportResults = () => {
    if (!testResults) return;
    
    const dataStr = JSON.stringify(testResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test-results-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'hl7-parser', label: 'HL7 Parser', icon: FileText },
    { id: 'fhir-validator', label: 'FHIR Validator', icon: CheckCircle },
    { id: 'transformation', label: 'Data Transformation', icon: RefreshCw },
    { id: 'load-testing', label: 'Load Testing', icon: Zap },
    { id: 'history', label: 'Test History', icon: Clock }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Integration Testing Tools</h1>
          <p className="mt-2 text-gray-600">Test and validate HL7/FHIR integrations</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'hl7-parser' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                HL7 Message Input
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    HL7 Message
                  </label>
                  <textarea
                    value={hl7Message}
                    onChange={(e) => setHl7Message(e.target.value)}
                    className="w-full h-64 p-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter HL7 message..."
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleParseHL7}
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {loading ? 'Parsing...' : 'Parse HL7'}
                  </button>
                  <button
                    onClick={() => setHl7Message(sampleHL7Message)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Load Sample
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-green-600" />
                Parsed Results
              </h3>
              
              {testResults && testResults.data ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">Parse Successful</span>
                    </div>
                    <div className="text-sm text-green-700">
                      {testResults.metadata.segmentCount} segments parsed
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Message Header</h4>
                    <pre className="bg-gray-50 p-3 rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(testResults.data.message.header, null, 2)}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Patient Data</h4>
                    <pre className="bg-gray-50 p-3 rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(testResults.data.patient, null, 2)}
                    </pre>
                  </div>
                  
                  {testResults && (
                    <button
                      onClick={handleExportResults}
                      className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export Results
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Parse an HL7 message to see results</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'fhir-validator' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                FHIR Resource Input
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    FHIR Resource (JSON)
                  </label>
                  <textarea
                    value={fhirResource}
                    onChange={(e) => setFhirResource(e.target.value)}
                    className="w-full h-64 p-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter FHIR resource JSON..."
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleValidateFHIR}
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {loading ? 'Validating...' : 'Validate FHIR'}
                  </button>
                  <button
                    onClick={() => setFhirResource(JSON.stringify(sampleFHIRResource, null, 2))}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Load Sample
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                Validation Results
              </h3>
              
              {testResults && testResults.data ? (
                <div className="space-y-4">
                  <div className={`border rounded-lg p-4 ${
                    testResults.data.validation.valid 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {testResults.data.validation.valid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className={`font-medium ${
                        testResults.data.validation.valid ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {testResults.data.validation.valid ? 'Valid' : 'Invalid'} FHIR Resource
                      </span>
                    </div>
                  </div>
                  
                  {testResults.data.validation.errors.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-800 mb-2">Errors</h4>
                      <ul className="space-y-1">
                        {testResults.data.validation.errors.map((error, index) => (
                          <li key={index} className="text-sm text-red-700 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {testResults.data.validation.warnings.length > 0 && (
                    <div>
                      <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
                      <ul className="space-y-1">
                        {testResults.data.validation.warnings.map((warning, index) => (
                          <li key={index} className="text-sm text-yellow-700 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Resource Structure</h4>
                    <pre className="bg-gray-50 p-3 rounded-lg text-sm overflow-x-auto max-h-64">
                      {JSON.stringify(testResults.data.resource, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Validate a FHIR resource to see results</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transformation' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-purple-600" />
                HL7 to FHIR Transformation
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source HL7 Message
                  </label>
                  <textarea
                    value={hl7Message}
                    onChange={(e) => setHl7Message(e.target.value)}
                    className="w-full h-48 p-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transformation Preview
                  </label>
                  <div className="h-48 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-y-auto">
                    {testResults && testResults.data ? (
                      <pre className="text-sm">
                        {JSON.stringify(testResults.data.transformed, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-gray-500 text-sm">Transform data to see preview</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleTransformData}
                  disabled={loading}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {loading ? 'Transforming...' : 'Transform Data'}
                </button>
                <button
                  onClick={() => setHl7Message(sampleHL7Message)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Load Sample
                </button>
              </div>
            </div>

            {testResults && testResults.data && testResults.data.mappings && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Applied Mappings</h3>
                <div className="space-y-2">
                  {testResults.data.mappings.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                      <span className="font-mono text-sm">{mapping.source}</span>
                      <RefreshCw className="w-4 h-4 text-gray-400" />
                      <span className="font-mono text-sm">{mapping.target}</span>
                      <span className="text-sm text-gray-600">{mapping.transformation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'load-testing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                Load Test Configuration
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Concurrent Requests
                  </label>
                  <input
                    type="number"
                    value={loadTestConfig.concurrentRequests}
                    onChange={(e) => setLoadTestConfig({
                      ...loadTestConfig,
                      concurrentRequests: parseInt(e.target.value) || 1
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={loadTestConfig.duration}
                    onChange={(e) => setLoadTestConfig({
                      ...loadTestConfig,
                      duration: parseInt(e.target.value) || 10
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="10"
                    max="300"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message Interval (ms)
                  </label>
                  <input
                    type="number"
                    value={loadTestConfig.messageInterval}
                    onChange={(e) => setLoadTestConfig({
                      ...loadTestConfig,
                      messageInterval: parseInt(e.target.value) || 1000
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="100"
                    max="10000"
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  onClick={handleLoadTest}
                  disabled={loading}
                  className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {loading ? 'Running Test...' : 'Start Load Test'}
                </button>
              </div>
            </div>

            {loadTestResults && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Load Test Results
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{loadTestResults.totalRequests}</p>
                    <p className="text-sm text-gray-600">Total Requests</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{loadTestResults.successful}</p>
                    <p className="text-sm text-gray-600">Successful</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{loadTestResults.failed}</p>
                    <p className="text-sm text-gray-600">Failed</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{loadTestResults.successRate}%</p>
                    <p className="text-sm text-gray-600">Success Rate</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{loadTestResults.averageDuration}ms</p>
                    <p className="text-sm text-gray-600">Avg Duration</p>
                  </div>
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <p className="text-2xl font-bold text-indigo-600">{loadTestResults.requestsPerSecond}</p>
                    <p className="text-sm text-gray-600">Requests/sec</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              Test History
            </h3>
            
            <div className="space-y-3">
              {testHistory.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    {test.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{test.type}</div>
                      <div className="text-sm text-gray-600">{test.details}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(test.timestamp).toLocaleString()} • {test.duration}ms
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    test.status === 'success' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {test.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationTestingTools;
