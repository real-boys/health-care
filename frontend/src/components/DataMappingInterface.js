import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

const DataMappingInterface = () => {
  const [mappings, setMappings] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [hl7Fields, setHl7Fields] = useState([]);
  const [fhirFields, setFhirFields] = useState([]);
  const [draggedField, setDraggedField] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [mappingName, setMappingName] = useState('');
  const [mappingDescription, setMappingDescription] = useState('');

  // Sample HL7 fields data structure
  const sampleHL7Fields = {
    'MSH': [
      { field: 'MSH.4', name: 'Sending Facility', type: 'ST', description: 'Facility sending the message' },
      { field: 'MSH.5', name: 'Receiving Facility', type: 'ST', description: 'Facility receiving the message' },
      { field: 'MSH.7', name: 'Date/Time', type: 'TS', description: 'Message timestamp' },
      { field: 'MSH.9', name: 'Message Type', type: 'CM', description: 'Message type and trigger event' },
      { field: 'MSH.10', name: 'Control ID', type: 'ST', description: 'Message control ID' }
    ],
    'PID': [
      { field: 'PID.3', name: 'Patient ID', type: 'CX', description: 'Patient identifier' },
      { field: 'PID.5', name: 'Patient Name', type: 'XPN', description: 'Patient name information' },
      { field: 'PID.7', name: 'Birth Date', type: 'DT', description: 'Date of birth' },
      { field: 'PID.8', name: 'Gender', type: 'IS', description: 'Administrative gender' },
      { field: 'PID.11', name: 'Address', type: 'XAD', description: 'Patient address' },
      { field: 'PID.13', name: 'Phone Number', type: 'XTN', description: 'Phone number' }
    ],
    'PV1': [
      { field: 'PV1.2', name: 'Patient Class', type: 'IS', description: 'Patient class (inpatient/outpatient)' },
      { field: 'PV1.3', name: 'Patient Location', type: 'PL', description: 'Assigned patient location' },
      { field: 'PV1.7', name: 'Attending Doctor', type: 'XCN', description: 'Attending physician' },
      { field: 'PV1.10', name: 'Hospital Service', type: 'IS', description: 'Hospital service' }
    ],
    'OBX': [
      { field: 'OBX.3', name: 'Observation ID', type: 'CE', description: 'Observation identifier' },
      { field: 'OBX.5', name: 'Observation Value', type: 'ST', description: 'Observation result value' },
      { field: 'OBX.6', name: 'Units', type: 'CE', description: 'Units of measurement' },
      { field: 'OBX.7', name: 'Reference Range', type: 'ST', description: 'Reference range' },
      { field: 'OBX.11', name: 'Result Status', type: 'IS', description: 'Observation result status' }
    ]
  };

  // Sample FHIR fields data structure
  const sampleFHIRFields = {
    'Patient': [
      { field: 'identifier', name: 'Identifier', type: 'Identifier', description: 'Patient identifiers' },
      { field: 'name', name: 'Name', type: 'HumanName', description: 'Patient name(s)' },
      { field: 'gender', name: 'Gender', type: 'code', description: 'Administrative gender' },
      { field: 'birthDate', name: 'Birth Date', type: 'date', description: 'Date of birth' },
      { field: 'address', name: 'Address', type: 'Address', description: 'Patient address(es)' },
      { field: 'telecom', name: 'Telecom', type: 'ContactPoint', description: 'Contact details' }
    ],
    'Encounter': [
      { field: 'identifier', name: 'Identifier', type: 'Identifier', description: 'Encounter identifiers' },
      { field: 'status', name: 'Status', type: 'code', description: 'Encounter status' },
      { field: 'class', name: 'Class', type: 'Coding', description: 'Encounter class' },
      { field: 'subject', name: 'Subject', type: 'Reference', description: 'Patient reference' },
      { field: 'period', name: 'Period', type: 'Period', description: 'Encounter period' },
      { field: 'location', name: 'Location', type: 'BackboneElement', description: 'Encounter locations' }
    ],
    'Observation': [
      { field: 'identifier', name: 'Identifier', type: 'Identifier', description: 'Observation identifiers' },
      { field: 'status', name: 'Status', type: 'code', description: 'Observation status' },
      { field: 'code', name: 'Code', type: 'CodeableConcept', description: 'Observation code' },
      { field: 'subject', name: 'Subject', type: 'Reference', description: 'Patient reference' },
      { field: 'effectiveDateTime', name: 'Effective Date', type: 'dateTime', description: 'Observation time' },
      { field: 'valueQuantity', name: 'Value', type: 'Quantity', description: 'Observation value' }
    ],
    'DiagnosticReport': [
      { field: 'identifier', name: 'Identifier', type: 'Identifier', description: 'Report identifiers' },
      { field: 'status', name: 'Status', type: 'code', description: 'Report status' },
      { field: 'code', name: 'Code', type: 'CodeableConcept', description: 'Report code' },
      { field: 'subject', name: 'Subject', type: 'Reference', description: 'Patient reference' },
      { field: 'result', name: 'Result', type: 'Reference', description: 'Observation references' }
    ]
  };

  useEffect(() => {
    // Initialize with sample data
    setHl7Fields(sampleHL7Fields);
    setFhirFields(sampleFHIRFields);
    
    // Load sample mappings
    setMappings([
      {
        id: 1,
        name: 'Patient Basic Info',
        description: 'Map basic patient demographic information',
        mappings: [
          { hl7Field: 'PID.3', fhirField: 'Patient.identifier', transformation: 'Direct mapping' },
          { hl7Field: 'PID.5', fhirField: 'Patient.name', transformation: 'Parse name components' },
          { hl7Field: 'PID.7', fhirField: 'Patient.birthDate', transformation: 'Format date (YYYYMMDD → YYYY-MM-DD)' },
          { hl7Field: 'PID.8', fhirField: 'Patient.gender', transformation: 'Map gender (M→male, F→female)' }
        ]
      }
    ]);
  }, []);

  const handleDragStart = (e, field, type) => {
    setDraggedField({ ...field, sourceType: type });
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e, targetField, targetType) => {
    e.preventDefault();
    
    if (!draggedField) return;

    const newMapping = {
      id: Date.now(),
      hl7Field: draggedField.sourceType === 'HL7' ? draggedField.field : targetField,
      fhirField: targetType === 'FHIR' ? draggedField.field : targetField,
      transformation: 'Direct mapping'
    };

    // Add to current mapping configuration
    if (selectedConfig) {
      const updatedMappings = mappings.map(mapping => 
        mapping.id === selectedConfig.id 
          ? { ...mapping, mappings: [...mapping.mappings, newMapping] }
          : mapping
      );
      setMappings(updatedMappings);
    }

    setDraggedField(null);
  };

  const handleRemoveMapping = (mappingId, configId) => {
    const updatedMappings = mappings.map(mapping => 
      mapping.id === configId 
        ? { ...mapping, mappings: mapping.mappings.filter(m => m.id !== mappingId) }
        : mapping
    );
    setMappings(updatedMappings);
  };

  const handleSaveMapping = async () => {
    if (!mappingName.trim()) {
      alert('Please enter a mapping name');
      return;
    }

    const newMapping = {
      id: Date.now(),
      name: mappingName,
      description: mappingDescription,
      mappings: []
    };

    setMappings([...mappings, newMapping]);
    setMappingName('');
    setMappingDescription('');
    setSelectedConfig(newMapping);
  };

  const handlePreviewTransformation = async () => {
    if (!selectedConfig || selectedConfig.mappings.length === 0) {
      alert('Please create some mappings first');
      return;
    }

    // Mock transformation preview
    const sampleHL7Data = {
      'PID.3': '12345^^^HOSPITAL^MR',
      'PID.5': 'DOE^JOHN^A^^^',
      'PID.7': '19700101',
      'PID.8': 'M'
    };

    const transformedData = {
      resourceType: 'Patient',
      identifier: [{ value: '12345', system: 'urn:oid:2.16.840.1.113883.4.1' }],
      name: [{ family: 'DOE', given: ['JOHN', 'A'] }],
      birthDate: '1970-01-01',
      gender: 'male'
    };

    setPreviewData({
      original: sampleHL7Data,
      transformed: transformedData,
      mappings: selectedConfig.mappings
    });
    setShowPreview(true);
  };

  const FieldTypeIcon = ({ type }) => {
    const colors = {
      'ST': 'bg-blue-100 text-blue-800',
      'CX': 'bg-green-100 text-green-800',
      'XPN': 'bg-purple-100 text-purple-800',
      'DT': 'bg-yellow-100 text-yellow-800',
      'IS': 'bg-red-100 text-red-800',
      'XAD': 'bg-indigo-100 text-indigo-800',
      'XTN': 'bg-pink-100 text-pink-800',
      'TS': 'bg-gray-100 text-gray-800',
      'CM': 'bg-orange-100 text-orange-800',
      'CE': 'bg-teal-100 text-teal-800',
      'PL': 'bg-cyan-100 text-cyan-800',
      'XCN': 'bg-lime-100 text-lime-800'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Mapping Interface</h1>
          <p className="mt-2 text-gray-600">Visual field mapping between HL7 and FHIR resources</p>
        </div>

        {/* Mapping Configuration */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Mapping Configurations</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPreview(true)}
                disabled={!selectedConfig || selectedConfig.mappings.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye className="w-4 h-4" />
                Preview Transformation
              </button>
              <button
                onClick={handleSaveMapping}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                Save Mapping
              </button>
            </div>
          </div>

          {/* New Mapping Form */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mapping Name
                </label>
                <input
                  type="text"
                  value={mappingName}
                  onChange={(e) => setMappingName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter mapping name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={mappingDescription}
                  onChange={(e) => setMappingDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief description"
                />
              </div>
            </div>
          </div>

          {/* Mapping Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              {mappings.map((mapping) => (
                <button
                  key={mapping.id}
                  onClick={() => setSelectedConfig(mapping)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    selectedConfig?.id === mapping.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {mapping.name}
                  {mapping.mappings.length > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {mapping.mappings.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Current Mappings */}
          {selectedConfig && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Field Mappings</h3>
              {selectedConfig.mappings.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Info className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No mappings created yet. Drag and drop fields below to create mappings.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedConfig.mappings.map((mapping) => (
                    <div key={mapping.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm bg-white px-2 py-1 rounded">{mapping.hl7Field}</span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="font-mono text-sm bg-white px-2 py-1 rounded">{mapping.fhirField}</span>
                        <span className="text-sm text-gray-600">{mapping.transformation}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMapping(mapping.id, selectedConfig.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visual Mapping Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* HL7 Fields */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">HL7 Fields</h3>
            <div className="space-y-4">
              {Object.entries(hl7Fields).map(([segment, fields]) => (
                <div key={segment}>
                  <h4 className="font-medium text-gray-700 mb-2">{segment} Segment</h4>
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <div
                        key={field.field}
                        draggable
                        onDragStart={(e) => handleDragStart(e, field, 'HL7')}
                        onDragOver={handleDragOver}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <div>
                            <div className="font-medium text-sm">{field.field}</div>
                            <div className="text-sm text-gray-600">{field.name}</div>
                          </div>
                        </div>
                        <FieldTypeIcon type={field.type} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FHIR Fields */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">FHIR Fields</h3>
            <div className="space-y-4">
              {Object.entries(fhirFields).map(([resource, fields]) => (
                <div key={resource}>
                  <h4 className="font-medium text-gray-700 mb-2">{resource} Resource</h4>
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <div
                        key={field.field}
                        draggable
                        onDragStart={(e) => handleDragStart(e, field, 'FHIR')}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, field.field, 'FHIR')}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <div>
                            <div className="font-medium text-sm">{field.field}</div>
                            <div className="text-sm text-gray-600">{field.name}</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {field.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transformation Preview Modal */}
        {showPreview && previewData && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold">Transformation Preview</h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Original HL7 Data</h4>
                    <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(previewData.original, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Transformed FHIR Data</h4>
                    <pre className="bg-green-50 p-4 rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(previewData.transformed, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Applied Mappings</h4>
                  <div className="space-y-2">
                    {previewData.mappings.map((mapping, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="font-mono text-sm">{mapping.hl7Field}</span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="font-mono text-sm">{mapping.fhirField}</span>
                        <span className="text-sm text-gray-600">{mapping.transformation}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Save Mapping
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataMappingInterface;
