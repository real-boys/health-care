import React from 'react';
import { 
  FileText, 
  Users, 
  Clock, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Award,
  ExternalLink
} from 'lucide-react';

const IssueCard = ({ issue, onApply, onContribute }) => {
  const getIssueTypeIcon = (type) => {
    switch (type) {
      case 'EMERGENCY_TREATMENT':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'SURGERY':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'PREVENTIVE_CARE':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'CHRONIC_CONDITION':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'MENTAL_HEALTH':
        return <Users className="w-4 h-4 text-purple-500" />;
      case 'REHABILITATION':
        return <TrendingUp className="w-4 h-4 text-indigo-500" />;
      case 'MEDICAL_EQUIPMENT':
        return <Award className="w-4 h-4 text-yellow-500" />;
      case 'RESEARCH_FUNDING':
        return <ExternalLink className="w-4 h-4 text-cyan-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 border-gray-300 text-gray-600';
      case 'SUBMITTED':
        return 'bg-blue-100 border-blue-300 text-blue-600';
      case 'UNDER_REVIEW':
        return 'bg-yellow-100 border-yellow-300 text-yellow-600';
      case 'PENDING_APPROVAL':
        return 'bg-orange-100 border-orange-300 text-orange-600';
      case 'APPROVED':
        return 'bg-green-100 border-green-300 text-green-600';
      case 'REJECTED':
        return 'bg-red-100 border-red-300 text-red-600';
      case 'COMPLETED':
        return 'bg-purple-100 border-purple-300 text-purple-600';
      case 'CANCELLED':
        return 'bg-gray-100 border-gray-300 text-gray-600';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-600';
    }
  };

  const formatDeadline = (deadline) => {
    const now = new Date();
    const deadlineDate = new Date(deadline * 1000);
    const daysLeft = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) {
      return { text: 'Expired', color: 'text-red-600' };
    } else if (daysLeft <= 3) {
      return { text: `${daysLeft} days left`, color: 'text-orange-600' };
    } else if (daysLeft <= 7) {
      return { text: `${daysLeft} days left`, color: 'text-yellow-600' };
    } else {
      return { text: `${daysLeft} days left`, color: 'text-green-600' };
    }
  };

  const deadline = formatDeadline(issue.deadline);

  return (
    <div className={`issue-card ${getStatusColor(issue.status)} border rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getIssueTypeIcon(issue.issueType)}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {issue.title}
              </h3>
              <p className="text-sm text-gray-600">
                {issue.issueType.replace('_', ' ').toLowerCase()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`text-sm font-medium ${deadline.color}`}>
              {deadline.text}
            </span>
            <span className="text-sm text-gray-500">
              • Created {new Date(issue.created * 1000).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>
            {issue.status.replace('_', ' ')}
          </span>
          <span className="text-sm text-gray-500">
            • {issue.totalApplications} applications
          </span>
        </div>
      </div>

        {/* Description */}
        <div className="mb-4">
          <p className="text-gray-700 text-sm leading-relaxed">
            {issue.description}
          </p>
        </div>

        {/* Funding Amount */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Funding Goal:</span>
            <div className="flex items-center">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xl font-bold text-gray-900">
                {(issue.fundingAmount / 1e18).toFixed(2)}
              </span>
              <span className="text-sm text-gray-500 ml-1">
                ETH
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {issue.requiredApprovals > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Approval Progress</span>
              <span>{issue.currentApprovals}/{issue.requiredApprovals}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(issue.currentApprovals / issue.requiredApprovals) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {issue.status === 'SUBMITTED' && onApply && (
            <button
              onClick={() => onApply(issue.id)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              <Users className="w-4 h-4" />
              Apply to Contribute
            </button>
          )}
          
          {issue.status === 'APPROVED' && onContribute && (
            <button
              onClick={() => onContribute(issue.id)}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-200"
            >
              <DollarSign className="w-4 h-4" />
              Contribute Funds
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              <Users className="w-4 h-4" />
              {issue.totalApplications} contributors
            </div>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueCard;
