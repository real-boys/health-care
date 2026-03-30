import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  GitBranch,
  Calendar,
  Users,
  BarChart3,
  FileText,
  Shield,
  Zap,
  Settings,
  TrendingUp,
  Activity,
  Eye,
  Download,
  MessageSquare,
  ExternalLink
} from 'lucide-react';

const UpgradeStatusTracker = ({ contract, userAddress }) => {
  const [proposals, setProposals] = useState([]);
  const [executions, setExecutions] = useState({});
  const [communications, setCommunications] = useState({});
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadUpgradeData();
  }, []);

  const loadUpgradeData = async () => {
    setLoading(true);
    try {
      // Load all proposals (active and historical)
      const allProposals = await contract.get_all_proposals();
      setProposals(allProposals);

      // Load execution records for executed proposals
      const executionData = {};
      const communicationData = {};
      
      for (const proposal of allProposals) {
        if (proposal.status === 'Executed') {
          try {
            const execution = await contract.get_execution_record(proposal.id);
            executionData[proposal.id] = execution;
          } catch (error) {
            console.error(`Failed to load execution for proposal ${proposal.id}:`, error);
          }
        }

        try {
          const comms = await contract.get_communications(proposal.id);
          communicationData[proposal.id] = comms;
        } catch (error) {
          console.error(`Failed to load communications for proposal ${proposal.id}:`, error);
        }
      }

      setExecutions(executionData);
      setCommunications(communicationData);
    } catch (error) {
      console.error('Failed to load upgrade data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTimelineEvents = (proposal) => {
    const events = [];
    
    // Proposal creation
    events.push({
      id: 'created',
      timestamp: proposal.created,
      type: 'created',
      title: 'Proposal Created',
      description: `Upgrade proposal "${proposal.title}" was created`,
      icon: FileText,
      color: 'blue'
    });

    // Risk assessment (if applicable)
    if (proposal.risk_level === 'High' || proposal.risk_level === 'Critical') {
      events.push({
        id: 'risk_assessment',
        timestamp: proposal.created + 3600, // Approximate
        type: 'assessment',
        title: 'Risk Assessment Completed',
        description: `Risk assessment completed for ${proposal.risk_level} risk proposal`,
        icon: Shield,
        color: 'orange'
      });
    }

    // Voting period
    events.push({
      id: 'voting_started',
      timestamp: proposal.created + 7200, // Approximate
      type: 'voting',
      title: 'Voting Period Started',
      description: `Stakeholder voting began with ${proposal.required_approval_percentage}% approval requirement`,
      icon: Users,
      color: 'purple'
    });

    // Voting deadline
    events.push({
      id: 'voting_deadline',
      timestamp: proposal.voting_deadline,
      type: 'deadline',
      title: 'Voting Deadline',
      description: `Voting period ended. Final results: ${proposal.votes_for} for, ${proposal.votes_against} against`,
      icon: Clock,
      color: 'gray'
    });

    // Proposal outcome
    if (proposal.status === 'Approved' || proposal.status === 'Executed') {
      events.push({
        id: 'approved',
        timestamp: proposal.voting_deadline + 3600, // Approximate
        type: 'approved',
        title: 'Proposal Approved',
        description: `Proposal received required approval and was approved for execution`,
        icon: CheckCircle,
        color: 'green'
      });
    } else if (proposal.status === 'Rejected') {
      events.push({
        id: 'rejected',
        timestamp: proposal.voting_deadline + 3600, // Approximate
        type: 'rejected',
        title: 'Proposal Rejected',
        description: `Proposal did not receive sufficient approval and was rejected`,
        icon: XCircle,
        color: 'red'
      });
    }

    // Execution (if applicable)
    const execution = executions[proposal.id];
    if (execution) {
      events.push({
        id: 'executed',
        timestamp: execution.execution_timestamp,
        type: 'executed',
        title: 'Upgrade Executed',
        description: `Smart contract upgrade was successfully executed by ${execution.executed_by}`,
        icon: Zap,
        color: 'green'
      });

      if (execution.rollback_available) {
        events.push({
          id: 'rollback_window',
          timestamp: execution.execution_timestamp,
          type: 'rollback',
          title: 'Rollback Window Open',
          description: `Rollback is available until ${new Date(execution.rollback_deadline * 1000).toLocaleDateString()}`,
          icon: Activity,
          color: 'orange'
        });
      }
    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'gray';
      case 'Proposed': return 'blue';
      case 'Voting': return 'purple';
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      case 'Executed': return 'green';
      case 'Cancelled': return 'gray';
      case 'Emergency': return 'orange';
      default: return 'gray';
    }
  };

  const getUpgradeTypeIcon = (type) => {
    const icons = {
      'Feature': Settings,
      'Security': Shield,
      'BugFix': Zap,
      'Optimization': BarChart3,
      'Emergency': AlertTriangle,
      'Governance': Users
    };
    return icons[type] || GitBranch;
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

  const filteredProposals = proposals.filter(proposal => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['Proposed', 'Voting', 'Approved'].includes(proposal.status);
    if (filter === 'executed') return proposal.status === 'Executed';
    if (filter === 'rejected') return proposal.status === 'Rejected';
    return true;
  });

  const openTimelineDialog = (proposal) => {
    setSelectedProposal(proposal);
    setTimelineEvents(generateTimelineEvents(proposal));
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
          <h1 className="text-3xl font-bold">Upgrade Status Tracker</h1>
          <p className="text-gray-600 mt-2">Monitor the status and timeline of smart contract upgrades</p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4" />
            <span>{proposals.length} Total</span>
          </Badge>
          <Badge variant="outline" className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>{filteredProposals.filter(p => ['Proposed', 'Voting', 'Approved'].includes(p.status)).length} Active</span>
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Filter Controls */}
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">Filter:</span>
            <div className="flex space-x-2">
              {['all', 'active', 'executed', 'rejected'].map(filterValue => (
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

          {/* Proposal Cards */}
          <div className="grid gap-6">
            {filteredProposals.map(proposal => {
              const Icon = getUpgradeTypeIcon(proposal.upgrade_type);
              const statusColor = getStatusColor(proposal.status);
              const riskColor = getRiskLevelColor(proposal.risk_level);
              const execution = executions[proposal.id];
              const comms = communications[proposal.id] || [];

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
                            <Badge variant={`outline-${statusColor}`}>{proposal.status}</Badge>
                            {proposal.emergency && (
                              <Badge variant="destructive" className="flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Emergency</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right text-sm">
                        <div className="flex items-center space-x-1 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Created: {new Date(proposal.created * 1000).toLocaleDateString()}</span>
                        </div>
                        {execution && (
                          <div className="flex items-center space-x-1 text-green-600 mt-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>Executed: {new Date(execution.execution_timestamp * 1000).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-gray-700 line-clamp-2">{proposal.description}</p>
                    
                    {/* Progress for active proposals */}
                    {['Proposed', 'Voting', 'Approved'].includes(proposal.status) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">
                            {proposal.status === 'Voting' ? 
                              `${((proposal.votes_for / (proposal.votes_for + proposal.votes_against)) * 100).toFixed(1)}% approval` :
                              proposal.status
                            }
                          </span>
                        </div>
                        <Progress 
                          value={proposal.status === 'Voting' ? 
                            (proposal.votes_for / (proposal.votes_for + proposal.votes_against)) * 100 : 
                            proposal.status === 'Approved' ? 100 : 50
                          } 
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Execution details */}
                    {execution && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-800">Successfully Executed</span>
                          </div>
                          <div className="text-sm text-green-700">
                            Gas used: {execution.gas_used.toLocaleString()}
                          </div>
                        </div>
                        {execution.rollback_available && (
                          <div className="mt-2 text-sm text-green-700">
                            Rollback available until {new Date(execution.rollback_deadline * 1000).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTimelineDialog(proposal)}
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          Timeline
                        </Button>
                        {comms.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            {comms.length} Updates
                          </Button>
                        )}
                        {execution && (
                          <Button
                            variant="outline"
                            size="sm"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                        )}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upgrade Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {proposals.slice(0, 10).map(proposal => {
                  const events = generateTimelineEvents(proposal);
                  const Icon = getUpgradeTypeIcon(proposal.upgrade_type);
                  
                  return (
                    <div key={proposal.id} className="relative">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <Icon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold">{proposal.title}</h4>
                            <Badge variant="outline">{proposal.status}</Badge>
                          </div>
                          <div className="mt-2 space-y-3">
                            {events.map((event, index) => {
                              const EventIcon = event.icon;
                              return (
                                <div key={event.id} className="flex items-center space-x-3 text-sm">
                                  <EventIcon className={`w-4 h-4 text-${event.color}-600`} />
                                  <div className="flex-1">
                                    <span className="font-medium">{event.title}</span>
                                    <span className="text-gray-600 ml-2">
                                      {new Date(event.timestamp * 1000).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {proposals.indexOf(proposal) < proposals.slice(0, 10).length - 1 && (
                        <div className="absolute left-3 top-12 w-0.5 h-full bg-gray-200"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions" className="space-y-6">
          <div className="grid gap-4">
            {Object.entries(executions).map(([proposalId, execution]) => {
              const proposal = proposals.find(p => p.id === parseInt(proposalId));
              if (!proposal) return null;

              return (
                <Card key={proposalId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{proposal.title}</CardTitle>
                      <Badge variant="default" className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Executed</span>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Executed By</div>
                        <div className="font-medium">
                          {execution.executed_by.slice(0, 6)}...{execution.executed_by.slice(-4)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Execution Date</div>
                        <div className="font-medium">
                          {new Date(execution.execution_timestamp * 1000).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Gas Used</div>
                        <div className="font-medium">{execution.gas_used.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Rollback</div>
                        <div className="font-medium">
                          {execution.rollback_available ? 'Available' : 'Not Available'}
                        </div>
                      </div>
                    </div>
                    
                    {execution.rollback_available && (
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-orange-800">
                            Rollback window closes: {new Date(execution.rollback_deadline * 1000).toLocaleDateString()}
                          </span>
                          <Button variant="outline" size="sm">
                            Initiate Rollback
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Total Proposals</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{proposals.length}</div>
                <p className="text-sm text-gray-600">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Executed</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Object.keys(executions).length}</div>
                <p className="text-sm text-gray-600">Successfully deployed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <XCircle className="w-5 h-5" />
                  <span>Rejected</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {proposals.filter(p => p.status === 'Rejected').length}
                </div>
                <p className="text-sm text-gray-600">Not approved</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Success Rate</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {proposals.length > 0 ? 
                    ((Object.keys(executions).length / proposals.length) * 100).toFixed(1) : 0}%
                </div>
                <p className="text-sm text-gray-600">Execution success</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upgrade Types Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['Feature', 'Security', 'BugFix', 'Optimization', 'Emergency', 'Governance'].map(type => {
                  const count = proposals.filter(p => p.upgrade_type === type).length;
                  const percentage = proposals.length > 0 ? (count / proposals.length) * 100 : 0;
                  
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{type}</span>
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

      {/* Timeline Dialog */}
      <Dialog open={!!selectedProposal} onOpenChange={() => setSelectedProposal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upgrade Timeline - {selectedProposal?.title}</DialogTitle>
          </DialogHeader>
          
          {selectedProposal && (
            <div className="space-y-6">
              {/* Proposal Summary */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Proposal Summary</h4>
                <p className="text-sm text-gray-700 mb-2">{selectedProposal.description}</p>
                <div className="flex items-center space-x-2 text-sm">
                  <Badge variant="outline">{selectedProposal.upgrade_type}</Badge>
                  <Badge variant={`outline-${getRiskLevelColor(selectedProposal.risk_level)}`}>
                    {selectedProposal.risk_level}
                  </Badge>
                  <Badge variant={`outline-${getStatusColor(selectedProposal.status)}`}>
                    {selectedProposal.status}
                  </Badge>
                </div>
              </div>

              {/* Timeline Events */}
              <div className="space-y-4">
                <h4 className="font-semibold">Timeline Events</h4>
                <div className="relative">
                  {timelineEvents.map((event, index) => {
                    const EventIcon = event.icon;
                    return (
                      <div key={event.id} className="flex items-start space-x-4 pb-6">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full bg-${event.color}-100 flex items-center justify-center`}>
                            <EventIcon className={`w-5 h-5 text-${event.color}-600`} />
                          </div>
                          {index < timelineEvents.length - 1 && (
                            <div className="absolute left-5 top-10 w-0.5 h-full bg-gray-200"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h5 className="font-medium">{event.title}</h5>
                            <span className="text-sm text-gray-600">
                              {new Date(event.timestamp * 1000).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{event.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Communications */}
              {communications[selectedProposal.id] && communications[selectedProposal.id].length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Communications</h4>
                  <div className="space-y-3">
                    {communications[selectedProposal.id].map(comm => (
                      <div key={comm.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{comm.message_type}</Badge>
                            <span className="font-medium">{comm.subject}</span>
                          </div>
                          <span className="text-sm text-gray-600">
                            {new Date(comm.timestamp * 1000).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{comm.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UpgradeStatusTracker;
