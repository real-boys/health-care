import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  Shield,
  Zap,
  Settings,
  GitBranch,
  Calendar,
  MessageSquare,
  BarChart3
} from 'lucide-react';

const UpgradeProposalInterface = ({ contract, userAddress, onProposalCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    upgradeType: '',
    riskLevel: '',
    implementationPlan: '',
    rollbackPlan: '',
    testResults: '',
    newContractHash: '',
    emergency: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stakeholderInfo, setStakeholderInfo] = useState(null);
  const [activeProposals, setActiveProposals] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);

  const upgradeTypes = [
    { value: 'Feature', label: 'Feature Enhancement', icon: Settings, color: 'blue' },
    { value: 'Security', label: 'Security Update', icon: Shield, color: 'red' },
    { value: 'BugFix', label: 'Bug Fix', icon: Zap, color: 'orange' },
    { value: 'Optimization', label: 'Performance Optimization', icon: BarChart3, color: 'green' },
    { value: 'Emergency', label: 'Emergency Fix', icon: AlertTriangle, color: 'red' },
    { value: 'Governance', label: 'Governance Change', icon: Users, color: 'purple' }
  ];

  const riskLevels = [
    { value: 'Low', label: 'Low Risk', color: 'green', requiredApproval: 51 },
    { value: 'Medium', label: 'Medium Risk', color: 'yellow', requiredApproval: 66 },
    { value: 'High', label: 'High Risk', color: 'orange', requiredApproval: 75 },
    { value: 'Critical', label: 'Critical Risk', color: 'red', requiredApproval: 90 }
  ];

  useEffect(() => {
    loadStakeholderInfo();
    loadActiveProposals();
  }, [userAddress]);

  const loadStakeholderInfo = async () => {
    try {
      const info = await contract.get_stakeholder(userAddress);
      setStakeholderInfo(info);
    } catch (error) {
      console.error('Failed to load stakeholder info:', error);
    }
  };

  const loadActiveProposals = async () => {
    try {
      const proposals = await contract.get_active_proposals();
      setActiveProposals(proposals);
    } catch (error) {
      console.error('Failed to load active proposals:', error);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.upgradeType) errors.upgradeType = 'Upgrade type is required';
    if (!formData.riskLevel) errors.riskLevel = 'Risk level is required';
    if (!formData.implementationPlan.trim()) errors.implementationPlan = 'Implementation plan is required';
    if (!formData.rollbackPlan.trim()) errors.rollbackPlan = 'Rollback plan is required';
    if (!formData.newContractHash.trim()) errors.newContractHash = 'Contract hash is required';
    if (!formData.testResults.trim()) errors.testResults = 'Test results are required';

    // Validate contract hash format (should be 32 bytes)
    if (formData.newContractHash && !/^0x[a-fA-F0-9]{64}$/.test(formData.newContractHash)) {
      errors.newContractHash = 'Invalid contract hash format';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileUpload = async (event, fileType) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', fileType);

    try {
      // Simulate file upload to IPFS
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const mockIpfsHash = `Qm${Array.from({length: 44}, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
          Math.floor(Math.random() * 62)
        ]
      ).join('')}`;

      handleInputChange(fileType, mockIpfsHash);
    } catch (error) {
      console.error('File upload failed:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    if (!stakeholderInfo || !stakeholderInfo.is_active) {
      alert('You must be an active stakeholder to create proposals');
      return;
    }

    setIsSubmitting(true);

    try {
      const proposalId = await contract.create_proposal(
        formData.title,
        formData.description,
        formData.upgradeType,
        formData.riskLevel,
        formData.newContractHash,
        formData.implementationPlan,
        formData.rollbackPlan,
        formData.testResults,
        formData.emergency,
        userAddress
      );

      onProposalCreated && onProposalCreated(proposalId);
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        upgradeType: '',
        riskLevel: '',
        implementationPlan: '',
        rollbackPlan: '',
        testResults: '',
        newContractHash: '',
        emergency: false
      });

      alert(`Proposal created successfully! ID: ${proposalId}`);
    } catch (error) {
      console.error('Failed to create proposal:', error);
      alert('Failed to create proposal: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUpgradeTypeIcon = (type) => {
    const upgradeType = upgradeTypes.find(t => t.value === type);
    return upgradeType ? upgradeType.icon : Settings;
  };

  const getRiskLevelColor = (level) => {
    const risk = riskLevels.find(r => r.value === level);
    return risk ? risk.color : 'gray';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Smart Contract Upgrade Proposals</h1>
          <p className="text-gray-600 mt-2">Submit and manage upgrade proposals for the healthcare contract</p>
        </div>
        {stakeholderInfo && (
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Stakeholder</span>
            </Badge>
            <Badge variant="outline" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Voting Power: {stakeholderInfo.voting_power}</span>
            </Badge>
          </div>
        )}
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">Create Proposal</TabsTrigger>
          <TabsTrigger value="active">Active Proposals</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          {!stakeholderInfo ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You need to be registered as a stakeholder to create upgrade proposals.
              </AlertDescription>
            </Alert>
          ) : !stakeholderInfo.is_active ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your stakeholder account is not active. Please contact the administrator.
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <GitBranch className="w-5 h-5" />
                  <span>Create Upgrade Proposal</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Title *</label>
                      <Input
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="Enter proposal title"
                        className={validationErrors.title ? 'border-red-500' : ''}
                      />
                      {validationErrors.title && (
                        <p className="text-sm text-red-500">{validationErrors.title}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Upgrade Type *</label>
                      <Select value={formData.upgradeType} onValueChange={(value) => handleInputChange('upgradeType', value)}>
                        <SelectTrigger className={validationErrors.upgradeType ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select upgrade type" />
                        </SelectTrigger>
                        <SelectContent>
                          {upgradeTypes.map(type => {
                            const Icon = type.icon;
                            return (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center space-x-2">
                                  <Icon className="w-4 h-4" />
                                  <span>{type.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {validationErrors.upgradeType && (
                        <p className="text-sm text-red-500">{validationErrors.upgradeType}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Risk Level *</label>
                      <Select value={formData.riskLevel} onValueChange={(value) => handleInputChange('riskLevel', value)}>
                        <SelectTrigger className={validationErrors.riskLevel ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                        <SelectContent>
                          {riskLevels.map(level => (
                            <SelectItem key={level.value} value={level.value}>
                              <div className="flex items-center justify-between w-full">
                                <span>{level.label}</span>
                                <Badge variant="outline" className={`text-${level.color}-600`}>
                                  {level.requiredApproval}% approval
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.riskLevel && (
                        <p className="text-sm text-red-500">{validationErrors.riskLevel}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">New Contract Hash *</label>
                      <Input
                        value={formData.newContractHash}
                        onChange={(e) => handleInputChange('newContractHash', e.target.value)}
                        placeholder="0x..."
                        className={validationErrors.newContractHash ? 'border-red-500' : ''}
                      />
                      {validationErrors.newContractHash && (
                        <p className="text-sm text-red-500">{validationErrors.newContractHash}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description *</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe the upgrade and its purpose"
                      rows={4}
                      className={validationErrors.description ? 'border-red-500' : ''}
                    />
                    {validationErrors.description && (
                      <p className="text-sm text-red-500">{validationErrors.description}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Implementation Plan *</label>
                    <Textarea
                      value={formData.implementationPlan}
                      onChange={(e) => handleInputChange('implementationPlan', e.target.value)}
                      placeholder="Detailed implementation steps and timeline"
                      rows={4}
                      className={validationErrors.implementationPlan ? 'border-red-500' : ''}
                    />
                    {validationErrors.implementationPlan && (
                      <p className="text-sm text-red-500">{validationErrors.implementationPlan}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rollback Plan *</label>
                    <Textarea
                      value={formData.rollbackPlan}
                      onChange={(e) => handleInputChange('rollbackPlan', e.target.value)}
                      placeholder="Steps to rollback if upgrade fails"
                      rows={3}
                      className={validationErrors.rollbackPlan ? 'border-red-500' : ''}
                    />
                    {validationErrors.rollbackPlan && (
                      <p className="text-sm text-red-500">{validationErrors.rollbackPlan}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Test Results *</label>
                      <div className="flex items-center space-x-2">
                        <Input
                          value={formData.testResults}
                          onChange={(e) => handleInputChange('testResults', e.target.value)}
                          placeholder="IPFS hash or test results"
                          className={validationErrors.testResults ? 'border-red-500' : ''}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('test-results-file').click()}
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                        <input
                          id="test-results-file"
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'testResults')}
                          accept=".pdf,.txt,.json"
                        />
                      </div>
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <Progress value={uploadProgress} className="w-full" />
                      )}
                      {validationErrors.testResults && (
                        <p className="text-sm text-red-500">{validationErrors.testResults}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.emergency}
                          onChange={(e) => handleInputChange('emergency', e.target.checked)}
                          className="rounded"
                        />
                        <span>Emergency Upgrade</span>
                      </label>
                      <p className="text-sm text-gray-600">
                        Emergency upgrades skip normal voting and require immediate execution
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={() => setFormData({})}>
                      Clear
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-6">
          <div className="grid gap-4">
            {activeProposals.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <GitBranch className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Active Proposals</h3>
                    <p className="text-gray-600">There are currently no active upgrade proposals.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              activeProposals.map(proposal => {
                const Icon = getUpgradeTypeIcon(proposal.upgrade_type);
                const riskColor = getRiskLevelColor(proposal.risk_level);
                
                return (
                  <Card key={proposal.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <Icon className="w-5 h-5" />
                          <div>
                            <CardTitle className="text-lg">{proposal.title}</CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline">{proposal.upgrade_type}</Badge>
                              <Badge variant={`outline-${riskColor}`}>{proposal.risk_level}</Badge>
                              <Badge variant={proposal.status === 'Voting' ? 'default' : 'secondary'}>
                                {proposal.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(proposal.voting_deadline * 1000).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 mt-1">
                            <Users className="w-4 h-4" />
                            <span>{proposal.votes_for + proposal.votes_against} votes</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 mb-4 line-clamp-2">{proposal.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>{proposal.votes_for}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-red-600">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{proposal.votes_against}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Proposal Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {upgradeTypes.map(type => {
                  const Icon = type.icon;
                  return (
                    <div key={type.value} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Icon className="w-5 h-5" />
                        <div>
                          <h4 className="font-semibold">{type.label}</h4>
                          <p className="text-sm text-gray-600">Template for {type.label.toLowerCase()} proposals</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Use Template
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UpgradeProposalInterface;
