import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { 
  MessageSquare, 
  Send, 
  Bell, 
  Users, 
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  FileText,
  Eye,
  Reply,
  Forward,
  Star,
  Filter,
  Search,
  Archive,
  Trash2,
  ExternalLink,
  User,
  Settings
} from 'lucide-react';

const CommunicationTools = ({ contract, userAddress, isAdmin, isProposalCreator }) => {
  const [communications, setCommunications] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [composeForm, setComposeForm] = useState({
    proposal_id: '',
    message_type: 'ANNOUNCEMENT',
    subject: '',
    content: '',
    recipients: []
  });
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommunicationData();
  }, []);

  const loadCommunicationData = async () => {
    setLoading(true);
    try {
      const [allProposals, allStakeholders] = await Promise.all([
        contract.get_active_proposals(),
        contract.get_all_stakeholders()
      ]);

      setProposals(allProposals);
      setStakeholders(allStakeholders);

      // Load communications for all proposals
      const allCommunications = [];
      for (const proposal of allProposals) {
        try {
          const proposalComms = await contract.get_communications(proposal.id);
          allCommunications.push(...proposalComms.map(comm => ({ ...comm, proposal_title: proposal.title })));
        } catch (error) {
          console.error(`Failed to load communications for proposal ${proposal.id}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      allCommunications.sort((a, b) => b.timestamp - a.timestamp);
      setCommunications(allCommunications);
    } catch (error) {
      console.error('Failed to load communication data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!composeForm.proposal_id || !composeForm.subject || !composeForm.content) {
      alert('Please fill in all required fields');
      return;
    }

    // Check permissions
    const proposal = proposals.find(p => p.id === parseInt(composeForm.proposal_id));
    if (!proposal) {
      alert('Invalid proposal selected');
      return;
    }

    const hasPermission = isAdmin || proposal.proposed_by === userAddress;
    if (!hasPermission) {
      alert('You don\'t have permission to send communications for this proposal');
      return;
    }

    setIsSending(true);
    try {
      const recipientAddresses = composeForm.recipients.length > 0 ? 
        composeForm.recipients : 
        stakeholders.map(s => s.address);

      await contract.send_communication(
        parseInt(composeForm.proposal_id),
        composeForm.message_type,
        composeForm.subject,
        composeForm.content,
        recipientAddresses,
        userAddress
      );

      alert('Communication sent successfully!');
      setComposeDialogOpen(false);
      setComposeForm({
        proposal_id: '',
        message_type: 'ANNOUNCEMENT',
        subject: '',
        content: '',
        recipients: []
      });
      
      await loadCommunicationData();
    } catch (error) {
      console.error('Failed to send communication:', error);
      alert('Failed to send communication: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const getMessageTypeIcon = (type) => {
    const icons = {
      'ANNOUNCEMENT': Bell,
      'WARNING': AlertTriangle,
      'UPDATE': Info,
      'QUESTION': MessageSquare,
      'URGENT': AlertTriangle
    };
    return icons[type] || MessageSquare;
  };

  const getMessageTypeColor = (type) => {
    switch (type) {
      case 'ANNOUNCEMENT': return 'blue';
      case 'WARNING': return 'orange';
      case 'UPDATE': return 'green';
      case 'QUESTION': return 'purple';
      case 'URGENT': return 'red';
      default: return 'gray';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const filteredCommunications = communications.filter(comm => {
    const matchesFilter = filter === 'all' || 
                         (filter === 'unread' && !comm.read_receipts.includes(userAddress)) ||
                         (filter === 'sent' && comm.sender === userAddress) ||
                         (filter === 'received' && comm.sender !== userAddress);
    
    const matchesSearch = searchTerm === '' || 
                         comm.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         comm.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         comm.proposal_title.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const markAsRead = async (communicationId) => {
    try {
      // In a real implementation, this would call the contract to mark as read
      const updatedCommunications = communications.map(comm => 
        comm.id === communicationId 
          ? { ...comm, read_receipts: [...comm.read_receipts, userAddress] }
          : comm
      );
      setCommunications(updatedCommunications);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const openCommunicationDialog = (communication) => {
    setSelectedCommunication(communication);
    if (!communication.read_receipts.includes(userAddress)) {
      markAsRead(communication.id);
    }
  };

  const addRecipient = (stakeholderAddress) => {
    if (!composeForm.recipients.includes(stakeholderAddress)) {
      setComposeForm(prev => ({
        ...prev,
        recipients: [...prev.recipients, stakeholderAddress]
      }));
    }
  };

  const removeRecipient = (stakeholderAddress) => {
    setComposeForm(prev => ({
      ...prev,
      recipients: prev.recipients.filter(addr => addr !== stakeholderAddress)
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
          <h1 className="text-3xl font-bold">Communication Center</h1>
          <p className="text-gray-600 mt-2">Manage stakeholder communications and updates</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => setComposeDialogOpen(true)}
            disabled={!isAdmin && !isProposalCreator}
          >
            <Send className="w-4 h-4 mr-2" />
            New Message
          </Button>
        </div>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-6">
          {/* Search and Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Messages</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message List */}
          <div className="grid gap-4">
            {filteredCommunications.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Messages</h3>
                    <p className="text-gray-600">
                      {searchTerm || filter !== 'all' ? 'No messages match your search criteria.' : 'No messages in your inbox.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredCommunications.map(communication => {
                const Icon = getMessageTypeIcon(communication.message_type);
                const typeColor = getMessageTypeColor(communication.message_type);
                const isRead = communication.read_receipts.includes(userAddress);
                const isFromMe = communication.sender === userAddress;

                return (
                  <Card 
                    key={communication.id} 
                    className={`cursor-pointer transition-colors hover:bg-gray-50 ${!isRead ? 'border-blue-500 bg-blue-50' : ''}`}
                    onClick={() => openCommunicationDialog(communication)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`p-2 rounded-full bg-${typeColor}-100`}>
                            <Icon className={`w-5 h-5 text-${typeColor}-600`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold truncate">{communication.subject}</h4>
                              {!isRead && (
                                <Badge variant="default" className="text-xs">New</Badge>
                              )}
                              {isFromMe && (
                                <Badge variant="outline" className="text-xs">Sent</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {communication.content}
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span className="flex items-center space-x-1">
                                <FileText className="w-3 h-3" />
                                <span>{communication.proposal_title}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>
                                  {communication.sender === userAddress ? 'You' : 
                                   `${communication.sender.slice(0, 6)}...${communication.sender.slice(-4)}`}
                                </span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatTimestamp(communication.timestamp)}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Users className="w-3 h-3" />
                                <span>{communication.recipients.length} recipients</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="sent" className="space-y-6">
          <div className="grid gap-4">
            {communications
              .filter(comm => comm.sender === userAddress)
              .map(communication => {
                const Icon = getMessageTypeIcon(communication.message_type);
                const typeColor = getMessageTypeIcon(communication.message_type);

                return (
                  <Card key={communication.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`p-2 rounded-full bg-${typeColor}-100`}>
                            <Icon className={`w-5 h-5 text-${typeColor}-600`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold">{communication.subject}</h4>
                              <Badge variant="outline" className="text-xs">
                                {communication.message_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {communication.content}
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span className="flex items-center space-x-1">
                                <Users className="w-3 h-3" />
                                <span>{communication.recipients.length} recipients</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <CheckCircle className="w-3 h-3" />
                                <span>{communication.read_receipts.length} read</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatTimestamp(communication.timestamp)}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>

        <TabsContent value="compose" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compose New Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Proposal *</label>
                  <Select 
                    value={composeForm.proposal_id} 
                    onValueChange={(value) => setComposeForm(prev => ({ ...prev, proposal_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a proposal" />
                    </SelectTrigger>
                    <SelectContent>
                      {proposals.filter(proposal => 
                        isAdmin || proposal.proposed_by === userAddress
                      ).map(proposal => (
                        <SelectItem key={proposal.id} value={proposal.id.toString()}>
                          {proposal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Message Type *</label>
                  <Select 
                    value={composeForm.message_type} 
                    onValueChange={(value) => setComposeForm(prev => ({ ...prev, message_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                      <SelectItem value="WARNING">Warning</SelectItem>
                      <SelectItem value="UPDATE">Update</SelectItem>
                      <SelectItem value="QUESTION">Question</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Subject *</label>
                <Input
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Enter message subject"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message *</label>
                <Textarea
                  value={composeForm.content}
                  onChange={(e) => setComposeForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your message here..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Recipients (Optional - leave empty to send to all stakeholders)</label>
                <div className="space-y-2">
                  {composeForm.recipients.map((address, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={address}
                        readOnly
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeRecipient(address)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Select onValueChange={addRecipient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add specific stakeholders" />
                    </SelectTrigger>
                    <SelectContent>
                      {stakeholders
                        .filter(s => !composeForm.recipients.includes(s.address))
                        .map(stakeholder => (
                          <SelectItem key={stakeholder.address} value={stakeholder.address}>
                            {stakeholder.address.slice(0, 6)}...{stakeholder.address.slice(-4)} 
                            ({stakeholder.voting_power} voting power)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button 
                  variant="outline" 
                  onClick={() => setComposeForm({
                    proposal_id: '',
                    message_type: 'ANNOUNCEMENT',
                    subject: '',
                    content: '',
                    recipients: []
                  })}
                >
                  Clear
                </Button>
                <Button 
                  onClick={handleSendMessage}
                  disabled={isSending || !composeForm.proposal_id || !composeForm.subject || !composeForm.content}
                >
                  {isSending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>Total Messages</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{communications.length}</div>
                <p className="text-sm text-gray-600">All communications</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Send className="w-5 h-5" />
                  <span>Sent by You</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {communications.filter(c => c.sender === userAddress).length}
                </div>
                <p className="text-sm text-gray-600">Messages sent</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Read Rate</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {communications.length > 0 ? 
                    Math.round(
                      communications.reduce((sum, comm) => 
                        sum + (comm.read_receipts.includes(userAddress) ? 1 : 0), 0
                    ) / communications.length * 100
                    ) : 0}%
                </div>
                <p className="text-sm text-gray-600">Messages read</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Active Stakeholders</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stakeholders.length}</div>
                <p className="text-sm text-gray-600">Total stakeholders</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Message Types Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['ANNOUNCEMENT', 'WARNING', 'UPDATE', 'QUESTION', 'URGENT'].map(type => {
                  const count = communications.filter(c => c.message_type === type).length;
                  const percentage = communications.length > 0 ? (count / communications.length) * 100 : 0;
                  
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{type}</span>
                        <span className="text-sm text-gray-600">{count} messages ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedCommunication} onOpenChange={() => setSelectedCommunication(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedCommunication?.subject}</DialogTitle>
          </DialogHeader>
          
          {selectedCommunication && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{selectedCommunication.message_type}</Badge>
                  <span className="text-sm text-gray-600">
                    From: {selectedCommunication.sender === userAddress ? 'You' : 
                     `${selectedCommunication.sender.slice(0, 6)}...${selectedCommunication.sender.slice(-4)}`}
                  </span>
                </div>
                <span className="text-sm text-gray-600">
                  {new Date(selectedCommunication.timestamp * 1000).toLocaleString()}
                </span>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Proposal: {selectedCommunication.proposal_title}</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedCommunication.content}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Recipients ({selectedCommunication.recipients.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCommunication.recipients.map((recipient, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {recipient.slice(0, 6)}...{recipient.slice(-4)}
                      {selectedCommunication.read_receipts.includes(recipient) && (
                        <CheckCircle className="w-3 h-3 ml-1 text-green-600" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-600">
                  {selectedCommunication.read_receipts.length} of {selectedCommunication.recipients.length} have read this message
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Reply className="w-4 h-4 mr-2" />
                    Reply
                  </Button>
                  <Button variant="outline" size="sm">
                    <Forward className="w-4 h-4 mr-2" />
                    Forward
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunicationTools;
