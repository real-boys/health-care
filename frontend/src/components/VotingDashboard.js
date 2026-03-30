import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { 
  Vote, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Users, 
  BarChart3,
  Calendar,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Shield,
  GitBranch,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Info
} from 'lucide-react';

const VotingDashboard = ({ contract, userAddress, onVoteCast }) => {
  const [activeProposals, setActiveProposals] = useState([]);
  const [userVotes, setUserVotes] = useState({});
  const [stakeholderInfo, setStakeholderInfo] = useState(null);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [voteForm, setVoteForm] = useState({ support: true, reason: '' });
  const [votingStats, setVotingStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVotingData();
  }, [userAddress]);

  const loadVotingData = async () => {
    setLoading(true);
    try {
      const [proposals, stakeholder] = await Promise.all([
        contract.get_active_proposals(),
        contract.get_stakeholder(userAddress).catch(() => null)
      ]);

      setActiveProposals(proposals);
      setStakeholderInfo(stakeholder);

      // Load user's votes and voting stats
      const votes = {};
      const stats = {};
      
      for (const proposal of proposals) {
        try {
          const proposalVotes = await contract.get_votes(proposal.id);
          const userVote = proposalVotes.find(v => v.voter === userAddress);
          if (userVote) {
            votes[proposal.id] = userVote;
          }

          // Calculate voting statistics
          const totalVotes = proposal.votes_for + proposal.votes_against;
          const approvalPercentage = totalVotes > 0 ? (proposal.votes_for / totalVotes) * 100 : 0;
          const timeRemaining = proposal.voting_deadline - Math.floor(Date.now() / 1000);
          
          stats[proposal.id] = {
            totalVotes,
            approvalPercentage,
            timeRemaining,
            hasVoted: !!userVote,
            canVote: stakeholder?.is_active && !userVote && timeRemaining > 0
          };
        } catch (error) {
          console.error(`Failed to load data for proposal ${proposal.id}:`, error);
        }
      }

      setUserVotes(votes);
      setVotingStats(stats);
    } catch (error) {
      console.error('Failed to load voting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalId) => {
    if (!stakeholderInfo || !stakeholderInfo.is_active) {
      alert('You must be an active stakeholder to vote');
      return;
    }

    try {
      await contract.vote(
        proposalId,
        voteForm.support,
        voteForm.reason,
        userAddress
      );

      onVoteCast && onVoteCast(proposalId);
      setVoteDialogOpen(false);
      setVoteForm({ support: true, reason: '' });
      
      // Refresh data
      await loadVotingData();
      
      alert('Vote cast successfully!');
    } catch (error) {
      console.error('Failed to cast vote:', error);
      alert('Failed to cast vote: ' + error.message);
    }
  };

  const openVoteDialog = (proposal, support) => {
    setSelectedProposal(proposal);
    setVoteForm({ support, reason: '' });
    setVoteDialogOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Voting': return 'blue';
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      case 'Emergency': return 'orange';
      default: return 'gray';
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

  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return 'Ended';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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
          <h1 className="text-3xl font-bold">Voting Dashboard</h1>
          <p className="text-gray-600 mt-2">Review and vote on active upgrade proposals</p>
        </div>
        {stakeholderInfo && (
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Voting Power: {stakeholderInfo.voting_power}</span>
            </Badge>
            <Badge variant="outline" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Stake: {stakeholderInfo.stake_amount}</span>
            </Badge>
          </div>
        )}
      </div>

      {!stakeholderInfo ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You need to be registered as a stakeholder to participate in voting.
          </AlertDescription>
        </Alert>
      ) : !stakeholderInfo.is_active ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your stakeholder account is not active. Please contact the administrator.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="proposals" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="proposals">Active Proposals</TabsTrigger>
          <TabsTrigger value="my-votes">My Votes</TabsTrigger>
          <TabsTrigger value="statistics">Voting Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="space-y-6">
          {activeProposals.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Vote className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Proposals</h3>
                  <p className="text-gray-600">There are currently no proposals requiring your vote.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {activeProposals.map(proposal => {
                const stats = votingStats[proposal.id] || {};
                const userVote = userVotes[proposal.id];
                const Icon = getUpgradeTypeIcon(proposal.upgrade_type);
                const statusColor = getStatusColor(proposal.status);
                const riskColor = getRiskLevelColor(proposal.risk_level);

                return (
                  <Card key={proposal.id} className="relative">
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
                            <span>Deadline: {formatTimeRemaining(stats.timeRemaining || 0)}</span>
                          </div>
                          <div className="flex items-center space-x-1 mt-1 text-gray-600">
                            <Users className="w-4 h-4" />
                            <span>{stats.totalVotes || 0} votes</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <p className="text-gray-700 line-clamp-3">{proposal.description}</p>
                      
                      {/* Voting Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Approval Progress</span>
                          <span className="font-medium">
                            {stats.approvalPercentage?.toFixed(1) || 0}% / {proposal.required_approval_percentage}%
                          </span>
                        </div>
                        <Progress 
                          value={Math.min(stats.approvalPercentage || 0, 100)} 
                          className="h-2"
                        />
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1 text-green-600">
                              <ThumbsUp className="w-4 h-4" />
                              <span>{proposal.votes_for}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-red-600">
                              <ThumbsDown className="w-4 h-4" />
                              <span>{proposal.votes_against}</span>
                            </div>
                          </div>
                          <div className="text-gray-600">
                            {stats.totalVotes || 0} of {activeProposals.length} stakeholders voted
                          </div>
                        </div>
                      </div>

                      {/* User Vote Status */}
                      {userVote && (
                        <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                          {userVote.support ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              You voted {userVote.support ? 'FOR' : 'AGAINST'} this proposal
                            </p>
                            {userVote.reason && (
                              <p className="text-sm text-gray-600 mt-1">{userVote.reason}</p>
                            )}
                          </div>
                          <Badge variant="outline">
                            {new Date(userVote.timestamp * 1000).toLocaleDateString()}
                          </Badge>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedProposal(proposal)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {/* Open communications */}}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Discussion
                          </Button>
                        </div>
                        
                        {stats.canVote && (
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openVoteDialog(proposal, false)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <ThumbsDown className="w-4 h-4 mr-2" />
                              Against
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openVoteDialog(proposal, true)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <ThumbsUp className="w-4 h-4 mr-2" />
                              For
                            </Button>
                          </div>
                        )}
                        
                        {!stats.canVote && !userVote && (
                          <Badge variant="outline" className="text-gray-600">
                            {stats.timeRemaining <= 0 ? 'Voting Ended' : 'Cannot Vote'}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-votes" className="space-y-6">
          <div className="grid gap-4">
            {Object.values(userVotes).length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Vote className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Votes Cast</h3>
                    <p className="text-gray-600">You haven't voted on any proposals yet.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              Object.values(userVotes).map(vote => {
                const proposal = activeProposals.find(p => p.id === vote.proposal_id);
                if (!proposal) return null;

                return (
                  <Card key={vote.proposal_id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          {vote.support ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <div>
                            <h4 className="font-semibold">{proposal.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Voted {vote.support ? 'FOR' : 'AGAINST'} on {new Date(vote.timestamp * 1000).toLocaleDateString()}
                            </p>
                            {vote.reason && (
                              <p className="text-sm text-gray-700 mt-2 italic">"{vote.reason}"</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={proposal.status === 'Approved' ? 'default' : 'secondary'}>
                          {proposal.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Total Proposals</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeProposals.length}</div>
                <p className="text-sm text-gray-600">Currently active</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Your Participation</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.values(userVotes).length}/{activeProposals.length}
                </div>
                <p className="text-sm text-gray-600">Proposals voted on</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Voting Power</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stakeholderInfo?.voting_power || 0}</div>
                <p className="text-sm text-gray-600">Current voting power</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Voting Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeProposals.map(proposal => {
                  const stats = votingStats[proposal.id] || {};
                  return (
                    <div key={proposal.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{proposal.title}</span>
                        <span className="text-sm text-gray-600">
                          {stats.approvalPercentage?.toFixed(1) || 0}% approval
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(stats.approvalPercentage || 0, 100)} 
                        className="h-2"
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Vote Dialog */}
      <Dialog open={voteDialogOpen} onOpenChange={setVoteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Cast Your Vote - {selectedProposal?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {selectedProposal && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Proposal Details</h4>
                <p className="text-sm text-gray-700 mb-2">{selectedProposal.description}</p>
                <div className="flex items-center space-x-2 text-sm">
                  <Badge variant="outline">{selectedProposal.upgrade_type}</Badge>
                  <Badge variant={`outline-${getRiskLevelColor(selectedProposal.risk_level)}`}>
                    {selectedProposal.risk_level}
                  </Badge>
                  <span className="text-gray-600">
                    Required approval: {selectedProposal.required_approval_percentage}%
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Button
                  variant={voteForm.support ? "default" : "outline"}
                  onClick={() => setVoteForm(prev => ({ ...prev, support: true }))}
                  className="flex-1"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Vote For
                </Button>
                <Button
                  variant={!voteForm.support ? "default" : "outline"}
                  onClick={() => setVoteForm(prev => ({ ...prev, support: false }))}
                  className="flex-1"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Vote Against
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason (Optional)</label>
                <Textarea
                  value={voteForm.reason}
                  onChange={(e) => setVoteForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Explain your voting decision..."
                  rows={3}
                />
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your vote is final and cannot be changed. Please review the proposal carefully before submitting.
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={() => setVoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => selectedProposal && handleVote(selectedProposal.id)}>
                Submit Vote
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VotingDashboard;
