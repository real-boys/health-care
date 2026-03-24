import React, { useState, useEffect } from 'react';
import {
  Eye,
  RefreshCw,
  Play,
  Save,
  Download,
  Upload,
  Settings,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Info,
  Code,
  FileText,
  Database,
  Zap
} from 'lucide-react';

const DataTransformationPreview = () => {
  const [sourceData, setSourceData] = useState('');
  const [targetFormat, setTargetFormat] = useState('fhir');
  const [transformationRules, setTransformationRules] = useState([]);
  const [previewResult, setPreviewResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [customRules, setCustomRules] = useState('');

  // Sample HL7 message
  const sampleHL7Message = `MSH|^~\\&|EPIC|HOSPITAL|LAB|LAB|20240115120000||ADT^A04|123456|P|2.5
PID|1||12345^^^HOSPITAL^MR||DOE^JOHN^A||19700101|M|||123 MAIN ST^^ANYTOWN^NY^12345||(555)555-1234|||S|C|123456789
PV1|1|I|ER^^^1^1||||123456^SMITH^JOHN^A^^MD||||||||ADM|A0`;

  // Sample transformation rules
  const sampleTransformationRules = [
    {
      id: 1,
      name: 'Patient Basic Info',
      description: 'Map basic patient demographic information',
      source: 'HL7',
      target: 'FHIR',
      rules: [
        { source: 'PID.3', target: 'Patient.identifier[0].value', transformation: 'Extract MRN' },
        { source: 'PID.5.1', target: 'Patient.name[0].family', transformation: 'Extract last name' },
        { source: 'PID.5.2', target: 'Patient.name[0].given[0]', transformation: 'Extract first name' },
        { source: 'PID.7', target: 'Patient.birthDate', transformation: 'Format YYYYMMDD to ISO date' },
        { source: 'PID.8', target: 'Patient.gender', transformation: 'Map M->male, F->female' }
      ]
    },
    {
      id: 2,
      name: 'Encounter Info',
      description: 'Map patient encounter information',
      source: 'HL7',
      target: 'FHIR',
      rules: [
        { source: 'PV1.2', target: 'Encounter.class.code', transformation: 'Map patient class' },
        { source: 'PV1.3', target: 'Encounter.location[0].location.display', transformation: 'Extract location' },
        { source: 'MSH.7', target: 'Encounter.period.start', transformation: 'Format timestamp' }
      ]
    }
  ];

  useEffect(() => {
    setSourceData(sampleHL7Message);
    setTransformationRules(sampleTransformationRules);
    setSelectedMapping(sampleTransformationRules[0]);
  }, []);

  const handlePreviewTransformation = async () => {
    if (!sourceData.trim()) {
      alert('Please enter source data to transform');
      return;
    }

    if (!selectedMapping) {
      alert('Please select a transformation mapping');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call for transformation
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock transformation result
      const transformedData = {
        resourceType: 'Bundle',
        id: 'transformation-preview',
        type: 'collection',
        entry: [
          {
            fullUrl: 'urn:uuid:patient-1',
            resource: {
              resourceType: 'Patient',
              id: 'patient-1',
              identifier: [
                {
                  type: {
                    coding: [{
                      system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                      code: 'MR',
                      display: 'Medical Record Number'
                    }]
                  },
                  value: '12345',
                  system: 'urn:oid:2.16.840.1.113883.4.1'
                }
              ],
              name: [
                {
                  use: 'official',
                  family: 'DOE',
                  given: ['JOHN', 'A']
                }
              ],
              gender: 'male',
              birthDate: '1970-01-01',
              address: [
                {
                  use: 'home',
                  line: ['123 MAIN ST'],
                  city: 'ANYTOWN',
                  state: 'NY',
                  postalCode: '12345'
                }
              ],
              telecom: [
                {
                  system: 'phone',
                  value: '(555)555-1234',
                  use: 'home'
                }
              ]
            }
          },
          {
            fullUrl: 'urn:uuid:encounter-1',
            resource: {
              resourceType: 'Encounter',
              id: 'encounter-1',
              status: 'finished',
              class: {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: 'IMP',
                display: 'inpatient encounter'
              },
              subject: {
                reference: 'Patient/patient-1',
                display: 'DOE, JOHN A'
              },
              period: {
                start: '2024-01-15T12:00:00Z'
              },
              location: [
                {
                  location: {
                    display: 'ER Room 1'
                  }
                }
              ]
            }
          }
        ]
      };

      const result = {
        success: true,
        originalData: sourceData,
        transformedData: transformedData,
        appliedRules: selectedMapping.rules,
        metadata: {
          transformationTime: new Date().toISOString(),
          sourceFormat: 'HL7 v2.x',
          targetFormat: 'FHIR R4',
          resourceCount: transformedData.entry.length,
          rulesApplied: selectedMapping.rules.length
        }
      };

      setPreviewResult(result);
    } catch (error) {
      setPreviewResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTransformation = async () => {
    if (!previewResult || !previewResult.success) {
      alert('Please generate a valid transformation preview first');
      return;
    }

    try {
      // Simulate saving transformation
      await new Promise(resolve => setTimeout(resolve, 500));
      alert('Transformation saved successfully!');
    } catch (error) {
      console.error('Error saving transformation:', error);
      alert('Failed to save transformation');
    }
  };

  const handleExportTransformation = () => {
    if (!previewResult) return;

    const exportData = {
      mapping: selectedMapping,
      originalData: previewResult.originalData,
      transformedData: previewResult.transformedData,
      metadata: previewResult.metadata,
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transformation-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadSampleData = (type) => {
    switch (type) {
      case 'hl7-adt':
        setSourceData(sampleHL7Message);
        break;
      case 'hl7-oru':
        setSourceData(`MSH|^~\\&|LAB|HOSPITAL|EHR|EHR|20240115120000||ORU^R01|123457|P|2.5
PID|1||12346^^^HOSPITAL^MR||SMITH^JANE^B||19800215|F|||456 OAK ST^^ANYTOWN^NY^12345||(555)555-5678|||S|C|987654321
OBR|1|123457|98765|CBC^COMPLETE BLOOD COUNT||20240115110000|||||||||98765^JOHNSON^MARY^C^^MD|||||||F||^^^LAB
OBX|1|NM|WBC^WHITE BLOOD COUNT||6.8|K/uL|4.5-11.0||||F|||20240115110000`);
        break;
      case 'json':
        setSourceData(JSON.stringify({
          patient: {
            id: '12345',
            name: 'JOHN DOE',
            birthDate: '1970-01-01',
            gender: 'M'
          },
          encounter: {
            id: 'ENC001',
            type: 'inpatient',
            location: 'ER'
          }
        }, null, 2));
        break;
    }
  };

  const renderTransformationRule = (rule, index) => (
    <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
      <div className="flex-1">
        <div className="font-mono text-sm bg-white px-2 py-1 rounded">{rule.source}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400" />
      <div className="flex-1">
        <div className="font-mono text-sm bg-white px-2 py-1 rounded">{rule.target}</div>
      </div>
      <div className="text-sm text-gray-600 max-w-xs truncate" title={rule.transformation}>
        {rule.transformation}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Data Transformation Preview</h1>
              <p className="mt-2 text-gray-600">Preview and validate data transformations before deployment</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <Settings className="w-4 h-4" />
                {showAdvanced ? 'Simple' : 'Advanced'}
              </button>
              {previewResult && previewResult.success && (
                <button
                  onClick={handleSaveTransformation}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Transformation Mapping */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Transformation Mapping
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Mapping
                  </label>
                  <select
                    value={selectedMapping?.id || ''}
                    onChange={(e) => {
                      const mapping = transformationRules.find(r => r.id === parseInt(e.target.value));
                      setSelectedMapping(mapping);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a mapping...</option>
                    {transformationRules.map(mapping => (
                      <option key={mapping.id} value={mapping.id}>
                        {mapping.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedMapping && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-1">{selectedMapping.name}</h4>
                    <p className="text-sm text-gray-600 mb-3">{selectedMapping.description}</p>
                    <div className="text-sm text-gray-500">
                      {selectedMapping.rules.length} transformation rules
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Format
                  </label>
                  <select
                    value={targetFormat}
                    onChange={(e) => setTargetFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="fhir">FHIR R4</option>
                    <option value="hl7">HL7 v2.x</option>
                    <option value="json">Custom JSON</option>
                    <option value="xml">XML</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sample Data */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-green-600" />
                Sample Data
              </h3>
              
              <div className="space-y-2">
                <button
                  onClick={() => handleLoadSampleData('hl7-adt')}
                  className="w-full text-left px-3 py-2 text-sm bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="font-medium">HL7 ADT Message</div>
                  <div className="text-gray-500">Patient admission message</div>
                </button>
                <button
                  onClick={() => handleLoadSampleData('hl7-oru')}
                  className="w-full text-left px-3 py-2 text-sm bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="font-medium">HL7 ORU Message</div>
                  <div className="text-gray-500">Laboratory results message</div>
                </button>
                <button
                  onClick={() => handleLoadSampleData('json')}
                  className="w-full text-left px-3 py-2 text-sm bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="font-medium">JSON Data</div>
                  <div className="text-gray-500">Structured patient data</div>
                </button>
              </div>
            </div>

            {/* Transformation Rules */}
            {selectedMapping && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-600" />
                  Applied Rules
                </h3>
                
                <div className="space-y-2">
                  {selectedMapping.rules.map((rule, index) => renderTransformationRule(rule, index))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Source Data Input */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Source Data
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSourceData('')}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              <textarea
                value={sourceData}
                onChange={(e) => setSourceData(e.target.value)}
                className="w-full h-64 p-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter source data (HL7 message, JSON, etc.)..."
              />
              
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handlePreviewTransformation}
                  disabled={loading || !sourceData.trim() || !selectedMapping}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {loading ? 'Transforming...' : 'Preview Transformation'}
                </button>
                {previewResult && previewResult.success && (
                  <button
                    onClick={handleExportTransformation}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                )}
              </div>
            </div>

            {/* Transformation Result */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-green-600" />
                Transformed Data
              </h3>
              
              {previewResult ? (
                previewResult.success ? (
                  <div className="space-y-4">
                    {/* Success Message */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">Transformation Successful</span>
                      </div>
                      <div className="text-sm text-green-700">
                        {previewResult.metadata.resourceCount} resources created using {previewResult.metadata.rulesApplied} transformation rules
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Source Format:</span>
                        <span className="ml-2 font-medium">{previewResult.metadata.sourceFormat}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Target Format:</span>
                        <span className="ml-2 font-medium">{previewResult.metadata.targetFormat}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Resources:</span>
                        <span className="ml-2 font-medium">{previewResult.metadata.resourceCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Rules Applied:</span>
                        <span className="ml-2 font-medium">{previewResult.metadata.rulesApplied}</span>
                      </div>
                    </div>

                    {/* Transformed Data */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Output Data</h4>
                      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="text-sm">
                          {JSON.stringify(previewResult.transformedData, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Applied Rules Summary */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Applied Transformation Rules</h4>
                      <div className="space-y-2">
                        {previewResult.appliedRules.map((rule, index) => renderTransformationRule(rule, index))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-800">Transformation Failed</span>
                    </div>
                    <div className="text-sm text-red-700">
                      {previewResult.error}
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Eye className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Enter source data and select a mapping to preview transformation</p>
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gray-600" />
                  Advanced Settings
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Transformation Rules (JSON)
                    </label>
                    <textarea
                      value={customRules}
                      onChange={(e) => setCustomRules(e.target.value)}
                      className="w-full h-32 p-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter custom transformation rules in JSON format..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Validation Mode
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="strict">Strict</option>
                        <option value="lenient">Lenient</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Error Handling
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="fail">Fail on Error</option>
                        <option value="skip">Skip Invalid Fields</option>
                        <option value="log">Log and Continue</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataTransformationPreview;
