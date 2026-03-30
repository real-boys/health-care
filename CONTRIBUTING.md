# Contributing to Healthcare Drips Platform

Thank you for your interest in contributing to the Healthcare Drips platform! This document provides comprehensive guidelines for contributors to ensure high-quality, consistent, and secure contributions.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Standards](#code-standards)
- [Frontend Guidelines](#frontend-guidelines)
- [Backend Guidelines](#backend-guidelines)
- [Smart Contract Guidelines](#smart-contract-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Code Review Process](#code-review-process)
- [Security Guidelines](#security-guidelines)
- [Documentation Standards](#documentation-standards)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn
- Git
- Basic knowledge of React, JavaScript/TypeScript, and Solidity
- Familiarity with blockchain concepts

### First Steps

1. **Fork the repository**
   ```bash
   # Fork the repository on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/health-care.git
   cd health-care
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/health-care.git
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

### Smart Contract Development

```bash
# Install Hardhat
npm install -g hardhat
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

## Code Standards

### General Principles

- **Write clean, readable, and maintainable code**
- **Follow DRY (Don't Repeat Yourself) principles**
- **Use meaningful variable and function names**
- **Keep functions small and focused on single responsibilities**
- **Add comments for complex business logic**

### File Naming Conventions

- **Components**: PascalCase (e.g., `PatientDashboard.jsx`)
- **Utilities**: camelCase (e.g., `formatDate.js`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.js`)
- **CSS/SCSS**: kebab-case (e.g., `patient-card.css`)

### Code Formatting

- Use **Prettier** for consistent code formatting
- Configure your editor to format on save
- Maximum line length: 100 characters
- Use 2 spaces for indentation (no tabs)

## Frontend Guidelines

### React Best Practices

```jsx
// ✅ Good: Functional components with hooks
const PatientCard = ({ patient, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const handleEdit = useCallback(() => {
    setIsEditing(true);
    onEdit(patient);
  }, [patient, onEdit]);

  return (
    <div className="patient-card">
      {/* Component JSX */}
    </div>
  );
};

// ❌ Bad: Class components for new code
class PatientCard extends React.Component {
  // Avoid class components for new development
}
```

### State Management

- Use **React Context** for global state
- Use **useState/useReducer** for local component state
- Avoid prop drilling when possible
- Consider **Redux Toolkit** for complex state management

### Styling Guidelines

```css
/* ✅ Good: BEM methodology */
.patient-card {}
.patient-card__header {}
.patient-card__content {}
.patient-card--highlighted {}

/* ✅ Good: Utility classes */
.flex { display: flex; }
.text-center { text-align: center; }

/* ❌ Bad: Overly specific selectors */
div.container > div.content > span.name {}
```

### Component Structure

```jsx
// File: components/PatientCard.jsx
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import './PatientCard.css';

const PatientCard = ({ patient, onEdit, onDelete }) => {
  // Hooks
  const [isLoading, setIsLoading] = useState(false);
  
  // Event handlers
  const handleEdit = useCallback(() => {
    setIsLoading(true);
    onEdit(patient);
  }, [patient, onEdit]);
  
  // Render
  return (
    <div className="patient-card">
      {/* JSX content */}
    </div>
  );
};

// PropTypes
PatientCard.propTypes = {
  patient: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func
};

PatientCard.defaultProps = {
  onDelete: () => {}
};

export default PatientCard;
```

## Backend Guidelines

### Node.js Best Practices

```javascript
// ✅ Good: Async/await with error handling
const getPatient = async (patientId) => {
  try {
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }
    return patient;
  } catch (error) {
    logger.error('Error fetching patient:', error);
    throw error;
  }
};

// ❌ Bad: Callback hell
const getPatient = (patientId, callback) => {
  Patient.findById(patientId, (err, patient) => {
    if (err) {
      callback(err);
    } else {
      callback(null, patient);
    }
  });
};
```

### API Design

```javascript
// ✅ Good: RESTful endpoints with proper HTTP methods
GET    /api/patients          // List patients
GET    /api/patients/:id      // Get specific patient
POST   /api/patients          // Create patient
PUT    /api/patients/:id      // Update patient
DELETE /api/patients/:id      // Delete patient

// ✅ Good: Consistent response format
{
  "success": true,
  "data": { ... },
  "message": "Patient created successfully",
  "timestamp": "2024-03-25T12:00:00Z"
}
```

### Error Handling

```javascript
// ✅ Good: Centralized error handling
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(err);

  // Send response
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};
```

## Smart Contract Guidelines

### Solidity Best Practices

```solidity
// ✅ Good: Secure and optimized contract
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HealthcareDrips is ReentrancyGuard, Ownable {
    // Use events for off-chain tracking
    event PremiumCreated(uint256 indexed dripId, address indexed patient);
    
    // Use struct for complex data
    struct PremiumDrip {
        address patient;
        address insurer;
        uint256 amount;
        uint256 interval;
        uint256 lastPayment;
        bool active;
    }
    
    // Mapping for efficient lookups
    mapping(uint256 => PremiumDrip) public premiumDrips;
    mapping(address => uint256[]) public patientDrips;
    
    // Modifiers for access control
    modifier onlyPatient(uint256 dripId) {
        require(
            premiumDrips[dripId].patient == msg.sender,
            "Not authorized"
        );
        _;
    }
    
    // Functions with proper validation
    function createPremiumDrip(
        address _insurer,
        uint256 _amount,
        uint256 _interval
    ) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(_interval > 0, "Interval must be greater than 0");
        
        // Implementation
    }
}
```

### Security Considerations

- **Use latest Solidity version** (0.8.x)
- **Implement ReentrancyGuard** for state-changing functions
- **Use OpenZeppelin contracts** for standard implementations
- **Validate all inputs** with require statements
- **Use events** for important state changes
- **Avoid floating-point math** - use fixed-point arithmetic
- **Implement proper access control** with modifiers

## Testing Requirements

### Frontend Testing

```javascript
// ✅ Good: Component testing with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import PatientCard from '../PatientCard';

describe('PatientCard', () => {
  const mockPatient = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com'
  };
  
  test('renders patient information correctly', () => {
    render(<PatientCard patient={mockPatient} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });
  
  test('calls onEdit when edit button is clicked', () => {
    const mockOnEdit = jest.fn();
    render(<PatientCard patient={mockPatient} onEdit={mockOnEdit} />);
    
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockOnEdit).toHaveBeenCalledWith(mockPatient);
  });
});
```

### Backend Testing

```javascript
// ✅ Good: API endpoint testing
const request = require('supertest');
const app = require('../app');

describe('Patient API', () => {
  describe('GET /api/patients', () => {
    test('should return all patients', async () => {
      const res = await request(app)
        .get('/api/patients')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
```

### Smart Contract Testing

```javascript
// ✅ Good: Contract testing with Hardhat
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('HealthcareDrips', () => {
  let healthcareDrips;
  let owner;
  let patient;
  
  beforeEach(async () => {
    [owner, patient] = await ethers.getSigners();
    const HealthcareDrips = await ethers.getContractFactory('HealthcareDrips');
    healthcareDrips = await HealthcareDrips.deploy();
    await healthcareDrips.deployed();
  });
  
  describe('createPremiumDrip', () => {
    it('should create a premium drip successfully', async () => {
      const tx = await healthcareDrips.createPremiumDrip(
        patient.address,
        ethers.utils.parseEther('0.5'),
        30 * 24 * 60 * 60
      );
      
      expect(tx).to.emit(healthcareDrips, 'PremiumCreated');
    });
  });
});
```

### Coverage Requirements

- **Frontend**: Minimum 80% code coverage
- **Backend**: Minimum 85% code coverage
- **Smart Contracts**: Minimum 90% code coverage

## Pull Request Process

### Before Creating a PR

1. **Ensure all tests pass**
   ```bash
   npm test
   ```

2. **Check code coverage**
   ```bash
   npm run test:coverage
   ```

3. **Run linting**
   ```bash
   npm run lint
   npm run lint:fix
   ```

4. **Format code**
   ```bash
   npm run format
   ```

5. **Update documentation** if needed

### PR Template

```markdown
## Description
Brief description of changes and their purpose.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No sensitive information committed
```

### PR Naming Convention

- **Feature**: `feat: add patient dashboard`
- **Bug Fix**: `fix: resolve login authentication issue`
- **Documentation**: `docs: update API documentation`
- **Refactoring**: `refactor: optimize database queries`

## Code Review Process

### Reviewer Guidelines

1. **Check for functional correctness**
2. **Verify security implications**
3. **Ensure code quality and maintainability**
4. **Validate test coverage**
5. **Check documentation updates**

### Review Timeline

- **Small changes**: 24-48 hours
- **Medium changes**: 2-3 days
- **Large changes**: 3-5 days

### Approval Requirements

- **At least 2 approvals** from core team members
- **All automated checks must pass**
- **No outstanding review comments**

## Security Guidelines

### General Security

- **Never commit sensitive data** (API keys, passwords, private keys)
- **Use environment variables** for configuration
- **Implement proper authentication and authorization**
- **Validate all user inputs**
- **Use HTTPS in production**

### Smart Contract Security

- **Conduct security audits** before mainnet deployment
- **Use established patterns** from OpenZeppelin
- **Implement emergency pause mechanisms**
- **Thoroughly test edge cases**
- **Consider gas optimization** without sacrificing security

## Documentation Standards

### Code Documentation

```javascript
/**
 * Creates a new premium drip for a patient
 * @param {Object} premiumData - The premium data
 * @param {string} premiumData.patientId - Patient identifier
 * @param {number} premiumData.amount - Premium amount in ETH
 * @param {number} premiumData.interval - Payment interval in seconds
 * @returns {Promise<Object>} Created premium drip object
 * @throws {Error} When validation fails
 * @example
 * const premium = await createPremiumDrip({
 *   patientId: '123',
 *   amount: 0.5,
 *   interval: 2592000
 * });
 */
const createPremiumDrip = async (premiumData) => {
  // Implementation
};
```

### README Updates

- **Update installation instructions** if needed
- **Add new features** to feature list
- **Update API documentation**
- **Include new environment variables**

### API Documentation

- Use **OpenAPI/Swagger** specifications
- Include **request/response examples**
- Document **authentication requirements**
- Provide **error response formats**

## Community Guidelines

### Code of Conduct

- **Be respectful and inclusive**
- **Provide constructive feedback**
- **Help others learn and grow**
- **Focus on what is best for the community**

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **Discord**: General discussion and questions
- **GitHub Discussions**: Community discussions and Q&A

### Getting Help

- **Check existing issues** before creating new ones
- **Provide detailed bug reports** with reproduction steps
- **Include environment details** in bug reports
- **Be patient** with volunteer maintainers

## Release Process

### Version Management

- Use **Semantic Versioning** (semver)
- **Patch versions** (x.x.1): Bug fixes
- **Minor versions** (x.1.x): New features
- **Major versions** (1.x.x): Breaking changes

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Security review completed
- [ ] Performance testing done

## Recognition

### Contributor Recognition

- **Contributors section** in README
- **Release notes** attribution
- **Community highlights**
- **Annual contributor awards**

### Becoming a Maintainer

- **Consistent quality contributions**
- **Active community participation**
- **Code review participation**
- **Mentorship of new contributors**

---

Thank you for contributing to Healthcare Drips! Your contributions help make healthcare more accessible and efficient for everyone.

If you have any questions about these guidelines, please open an issue or start a discussion on GitHub.
