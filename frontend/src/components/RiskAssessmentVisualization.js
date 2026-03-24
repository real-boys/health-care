import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Activity,
  FileText,
  BarChart3,
  Zap,
  Settings,
  Eye,
  Download,
  Upload,
  Info,
  Target,
  Lock,
  Unlock,
  Clock,
  Calendar,
  User,
  ExternalLink
} from 'lucide-react';

const RiskAssessmentVisualization = ({ contract, userAddress, isAdmin }) => {
  const [proposals, setProposals] = useState([]);
  const [riskAssessments, setRiskAssessments] = useState({});
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [assessmentForm, setAssessmentForm] = useState({
    security_score: 0,
    compatibility_score: 0,
    performance_impact: 0,
    breaking_changes: [],
    dependencies_affected: [],
    rollback_complexity: 'Low',
    test_coverage: 0,
    auditor_notes: ''
  });
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    loadRiskAssessmentData();
  }, []);

  const loadRiskAssessmentData = async () => {
    setLoading(true);
    try {
      const allProposals = await contract.get_active_proposals();
      setProposals(allProposals);

      // Load risk assessments for proposals that require them
      const assessmentData = {};
      for (const proposal of allProposals) {
        if (proposal.risk_level === 'High' || proposal.risk_level === 'Critical') {
          try {
            const assessment = await contract.get_risk_assessment(proposal.id);
            assessmentData[proposal.id] = assessment;
          } catch (error) {
            // Assessment not yet submitted
            assessmentData[proposal.id] = null;
          }
        }
      }
      setRiskAssessments(assessmentData);
    } catch (error) {
      console.error('Failed to load risk assessment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAssessment = async (proposalId) => {
    if (!isAdmin) {
      alert('Only administrators can submit risk assessments');
      return;
    }

    setIsSubmittingAssessment(true);
    try {
      await contract.submit_risk_assessment(
        proposalId,
        {
          proposal_id: proposalId,
          security_score: assessmentForm.security_score,
          compatibility_score: assessmentForm.compatibility_score,
          performance_impact: assessmentForm.performance_impact,
          breaking_changes: assessmentForm.breaking_changes,
          dependencies_affected: assessmentForm.dependencies_affected,
          rollback_complexity: assessmentForm.rollback_complexity,
          test_coverage: assessmentForm.test_coverage,
          auditor_notes: assessmentForm.auditor_notes,
          assessed_by: userAddress,
          assessment_date: Math.floor(Date.now() / 1000)
        },
        userAddress
      );

      alert('Risk assessment submitted successfully!');
      setSelectedProposal(null);
      setAssessmentForm({
        security_score: 0,
        compatibility_score: 0,
        performance_impact: 0,
        breaking_changes: [],
        dependencies_affected: [],
        rollback_complexity: 'Low',
        test_coverage: 0,
        auditor_notes: ''
      });
      
      await loadRiskAssessmentData();
    } catch (error) {
      console.error('Failed to submit risk assessment:', error);
      alert('Failed to submit risk assessment: ' + error.message);
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const getRiskLevelColor = (level) => {
    switch (level) {
      case 'Low': return 'green';
      case 'Medium': return 'yellow';
      case 'High': return 'orange';
      case 'Critical': return 'red';
      default: return 'gray';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  };

  const getOverallRiskScore = (assessment) => {
    if (!assessment) return 0;
    
    const securityWeight = 0.3;
    const compatibilityWeight = 0.25;
    const performanceWeight = 0.2;
    const testCoverageWeight = 0.15;
    const complexityWeight = 0.1;
    
    const complexityScore = assessment.rollback_complexity === 'Low' ? 100 :
                           assessment.rollback_complexity === 'Medium' ? 66 :
                           assessment.rollback_complexity === 'High' ? 33 : 0;
    
    const overallScore = (
      assessment.security_score * securityWeight +
      assessment.compatibility_score * compatibilityWeight +
      Math.max(0, 100 - Math.abs(assessment.performance_impact)) * performanceWeight +
      assessment.test_coverage * testCoverageWeight +
      complexityScore * complexityWeight
    );
    
    return Math.round(overallScore);
  };

  const getRiskLevelFromScore = (score) => {
    if (score >= 80) return 'Low';
    if (score >= 60) return 'Medium';
    if (score >= 40) return 'High';
    return 'Critical';
  };

  const filteredProposals = proposals.filter(proposal => {
    const assessment = riskAssessments[proposal.id];
    if (filter === 'pending') return proposal.risk_level === 'High' || proposal.risk_level === 'Critical';
    if (filter === 'assessed') return assessment !== null && assessment !== undefined;
    if (filter === 'all') return true;
    return true;
  });

  const openAssessmentDialog = (proposal) => {
    setSelectedProposal(proposal);
    const existingAssessment = riskAssessments[proposal.id];
    if (existingAssessment) {
      setAssessmentForm({
        security_score: existingAssessment.security_score,
        compatibility_score: existingAssessment.compatibility_score,
        performance_impact: existingAssessment.performance_impact,
        breaking_changes: existingAssessment.breaking_changes,
        dependencies_affected: existingAssessment.dependencies_affected,
        rollback_complexity: existingAssessment.rollback_complexity,
        test_coverage: existingAssessment.test_coverage,
        auditor_notes: existingAssessment.auditor_notes
      });
    }
  };

  const addBreakingChange = () => {
    setAssessmentForm(prev => ({
      ...prev,
      breaking_changes: [...prev.breaking_changes, '']
    }));
  };

  const updateBreakingChange = (index, value) => {
    setAssessmentForm(prev => ({
      ...prev,
      breaking_changes: prev.breaking_changes.map((change, i) => 
        i === index ? value : change
      )
    }));
  };

  const removeBreakingChange = (index) => {
    setAssessmentForm(prev => ({
      ...prev,
      breaking_changes: prev.breaking_changes.filter((_, i) => i !== index)
    }));
  };

  const addDependency = () => {
    setAssessmentForm(prev => ({
      ...prev,
      dependencies_affected: [...prev.dependencies_affected, '']
    }));
  };

  const updateDependency = (index, value) => {
    setAssessmentForm(prev => ({
      ...prev,
      dependencies_affected: prev.dependencies_affected.map((dep, i) => 
        i === index ? value : dep
      )
    }));
  };

  const removeDependency = (index) => {
    setAssessmentForm(prev => ({
      ...prev,
      dependencies_affected: prev.dependencies_affected.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Risk Assessment</h1>
          <p className="text-gray-600 mt-2">Evaluate and visualize upgrade proposal risks</p>
        </div>
        {isAdmin && (
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Administrator</span>
            </Badge>
          </div>
        )}
      </div>

      <Tabs defaultValue="proposals" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="assessment">Assessment Tool</TabsTrigger>
          <TabsTrigger value="analytics">Risk Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="space-y-6">
          {/* Filter Controls */}
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">Filter:</span>
            <div className="flex space-x-2">
              {['pending', 'assessed', 'all'].map(filterValue => (
                <Button
                  key={filterValue}
                  variant={filter === filterValue ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(filterValue)}
                >
                  {filterValue.charAt(0).toUpperCase() + filterValue.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            {filteredProposals.map(proposal => {
              const assessment = riskAssessments[proposal.id];
              const overallScore = assessment ? getOverallRiskScore(assessment) : 0;
              const riskColor = getRiskLevelColor(proposal.risk_level);
              const scoreColor = getScoreColor(overallScore);

              return (
                <Card key={proposal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{proposal.title}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline">{proposal.upgrade_type}</Badge>
                          <Badge variant={`outline-${riskColor}`}>{proposal.risk_level}</Badge>
                          <Badge variant="outline">{proposal.status}</Badge>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {assessment ? (
                          <div className="space-y-2">
                            <div className="text-2xl font-bold text-green-600">{overallScore}</div>
                            <div className="text-sm text-gray-600">Risk Score</div>
                            <Badge variant={`outline-${scoreColor}`}>
                              {getRiskLevelFromScore(overallScore)} Risk
                            </Badge>
                          </div>
                        ) : (
                          <div className="text-center">
                            <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                            <div className="text-sm font-medium">Assessment Required</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-gray-700 line-clamp-2">{proposal.description}</p>
                    
                    {assessment && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm text-gray-600">Security</div>
                          <div className="flex items-center space-x-2">
                            <Progress value={assessment.security_score} className="h-2 flex-1" />
                            <span className="text-sm font-medium">{assessment.security_score}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Compatibility</div>
                          <div className="flex items-center space-x-2">
                            <Progress value={assessment.compatibility_score} className="h-2 flex-1" />
                            <span className="text-sm font-medium">{assessment.compatibility_score}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Performance</div>
                          <div className="flex items-center space-x-2">
                            <div className={`text-sm font-medium ${
                              assessment.performance_impact > 0 ? 'text-green-600' : 
                              assessment.performance_impact < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {assessment.performance_impact > 0 ? '+' : ''}{assessment.performance_impact}%
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Test Coverage</div>
                          <div className="flex items-center space-x-2">
                            <Progress value={assessment.test_coverage} className="h-2 flex-1" />
                            <span className="text-sm font-medium">{assessment.test_coverage}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center space-x-2">
                        {assessment && (
                          <>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-2" />
                              View Assessment
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-2" />
                              Export Report
                            </Button>
                          </>
                        )}
                      </div>
                      
                      {isAdmin && !assessment && (
                        <Button
                          size="sm"
                          onClick={() => openAssessmentDialog(proposal)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Conduct Assessment
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="assessment" className="space-y-6">
          {!isAdmin ? (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Only administrators can conduct risk assessments.
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Risk Assessment Tool</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedProposal ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold mb-2">{selectedProposal.title}</h4>
                      <p className="text-sm text-gray-700">{selectedProposal.description}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline">{selectedProposal.upgrade_type}</Badge>
                        <Badge variant={`outline-${getRiskLevelColor(selectedProposal.risk_level)}`}>
                          {selectedProposal.risk_level}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Security Score (0-100)</label>
                        <div className="space-y-2">
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            value={assessmentForm.security_score}
                            onChange={(e) => setAssessmentForm(prev => ({ 
                              ...prev, 
                              security_score: parseInt(e.target.value) 
                            }))}
                          />
                          <div className="flex items-center justify-between">
                            <Progress value={assessmentForm.security_score} className="h-2 flex-1" />
                            <span className="text-sm font-medium ml-2">{assessmentForm.security_score}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Compatibility Score (0-100)</label>
                        <div className="space-y-2">
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            value={assessmentForm.compatibility_score}
                            onChange={(e) => setAssessmentForm(prev => ({ 
                              ...prev, 
                              compatibility_score: parseInt(e.target.value) 
                            }))}
                          />
                          <div className="flex items-center justify-between">
                            <Progress value={assessmentForm.compatibility_score} className="h-2 flex-1" />
                            <span className="text-sm font-medium ml-2">{assessmentForm.compatibility_score}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Performance Impact (-100 to +100)</label>
                        <div className="space-y-2">
                          <Input
                            type="range"
                            min="-100"
                            max="100"
                            value={assessmentForm.performance_impact}
                            onChange={(e) => setAssessmentForm(prev => ({ 
                              ...prev, 
                              performance_impact: parseInt(e.target.value) 
                            }))}
                          />
                          <div className="flex items-center justify-between">
                            <div className={`text-sm font-medium ${
                              assessmentForm.performance_impact > 0 ? 'text-green-600' : 
                              assessmentForm.performance_impact < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {assessmentForm.performance_impact > 0 ? '+' : ''}{assessmentForm.performance_impact}%
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Test Coverage (%)</label>
                        <div className="space-y-2">
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            value={assessmentForm.test_coverage}
                            onChange={(e) => setAssessmentForm(prev => ({ 
                              ...prev, 
                              test_coverage: parseInt(e.target.value) 
                            }))}
                          />
                          <div className="flex items-center justify-between">
                            <Progress value={assessmentForm.test_coverage} className="h-2 flex-1" />
                            <span className="text-sm font-medium ml-2">{assessmentForm.test_coverage}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Rollback Complexity</label>
                        <Select 
                          value={assessmentForm.rollback_complexity} 
                          onValueChange={(value) => setAssessmentForm(prev => ({ 
                            ...prev, 
                            rollback_complexity: value 
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low - Simple rollback</SelectItem>
                            <SelectItem value="Medium">Medium - Some complexity</SelectItem>
                            <SelectItem value="High">High - Complex rollback</SelectItem>
                            <SelectItem value="Critical">Critical - Very difficult rollback</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Breaking Changes</label>
                        {assessmentForm.breaking_changes.map((change, index) => (
                          <div key={index} className="flex items-center space-x-2 mt-2">
                            <Input
                              value={change}
                              onChange={(e) => updateBreakingChange(index, e.target.value)}
                              placeholder="Describe breaking change"
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeBreakingChange(index)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addBreakingChange}
                          className="mt-2"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Breaking Change
                        </Button>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Affected Dependencies</label>
                        {assessmentForm.dependencies_affected.map((dep, index) => (
                          <div key={index} className="flex items-center space-x-2 mt-2">
                            <Input
                              value={dep}
                              onChange={(e) => updateDependency(index, e.target.value)}
                              placeholder="Dependency name or module"
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeDependency(index)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addDependency}
                          className="mt-2"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Dependency
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Auditor Notes</label>
                        <Textarea
                          value={assessmentForm.auditor_notes}
                          onChange={(e) => setAssessmentForm(prev => ({ 
                            ...prev, 
                            auditor_notes: e.target.value 
                          }))}
                          placeholder="Detailed assessment notes and recommendations..."
                          rows={4}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setSelectedProposal(null)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => handleSubmitAssessment(selectedProposal.id)}
                        disabled={isSubmittingAssessment}
                      >
                        {isSubmittingAssessment ? 'Submitting...' : 'Submit Assessment'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Select a Proposal</h3>
                    <p className="text-gray-600">Choose a proposal from the list to conduct a risk assessment.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Average Security Score</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.values(riskAssessments).filter(Boolean).length > 0 ?
                    Math.round(Object.values(riskAssessments).filter(Boolean).reduce((sum, assessment) => 
                      sum + assessment.security_score, 0) / Object.values(riskAssessments).filter(Boolean).length) : 0}
                </div>
                <p className="text-sm text-gray-600">Across all assessments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>High Risk Proposals</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {proposals.filter(p => p.risk_level === 'High' || p.risk_level === 'Critical').length}
                </div>
                <p className="text-sm text-gray-600">Requiring assessment</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Assessments Completed</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.values(riskAssessments).filter(Boolean).length}
                </div>
                <p className="text-sm text-gray-600">Risk evaluations completed</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['Low', 'Medium', 'High', 'Critical'].map(level => {
                  const count = proposals.filter(p => p.risk_level === level).length;
                  const percentage = proposals.length > 0 ? (count / proposals.length) * 100 : 0;
                  const color = getRiskLevelColor(level);
                  
                  return (
                    <div key={level} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{level} Risk</span>
                        <span className="text-sm text-gray-600">{count} proposals ({percentage.toFixed(1)}%)</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
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

export default RiskAssessmentVisualization;
