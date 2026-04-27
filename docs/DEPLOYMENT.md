# Deployment Guide

This comprehensive guide covers deploying the Healthcare Drips platform to production environments, including infrastructure requirements, security configurations, and step-by-step deployment procedures.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Infrastructure Requirements](#infrastructure-requirements)
- [Environment Configuration](#environment-configuration)
- [Security Setup](#security-setup)
- [Frontend Deployment](#frontend-deployment)
- [Backend Deployment](#backend-deployment)
- [Smart Contract Deployment](#smart-contract-deployment)
- [Database Setup](#database-setup)
- [Monitoring & Logging](#monitoring--logging)
- [CI/CD Pipeline](#cicd-pipeline)
- [Post-Deployment Checklist](#post-deployment-checklist)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools & Services
- **Domain name** (e.g., healthcare-drips.com)
- **SSL certificates** (wildcard recommended)
- **Cloud provider account** (AWS, GCP, Azure, or Vercel/Netlify)
- **Container registry** (Docker Hub, AWS ECR, GCR)
- **Monitoring service** (DataDog, New Relic, or CloudWatch)
- **Email service** (SendGrid, AWS SES, or Mailgun)
- **CDN service** (Cloudflare, AWS CloudFront)

### Team Requirements
- **DevOps engineer** with cloud platform experience
- **Security specialist** for security configuration
- **Backend developer** for API deployment
- **Smart contract developer** for blockchain deployment
- **Database administrator** for database setup

## Infrastructure Requirements

### Minimum Production Specifications

#### Frontend (Static Hosting)
- **Bandwidth**: 100GB+ monthly transfer
- **Storage**: 10GB+ SSD storage
- **CDN**: Global distribution enabled
- **SSL**: TLS 1.3 with automatic renewal
- **Build time**: < 5 minutes

#### Backend (Application Server)
- **CPU**: 2+ vCPUs (4+ recommended)
- **Memory**: 4GB+ RAM (8GB+ recommended)
- **Storage**: 50GB+ SSD (100GB+ recommended)
- **Network**: 1Gbps+ bandwidth
- **Load balancer**: Auto-scaling enabled

#### Database
- **Type**: PostgreSQL 14+ or MongoDB 5.0+
- **CPU**: 2+ vCPUs
- **Memory**: 4GB+ RAM
- **Storage**: 100GB+ SSD with automatic backups
- **Replication**: Multi-AZ or multi-region
- **Connection pool**: 20+ max connections

#### Smart Contracts
- **Network**: Ethereum Mainnet or Polygon
- **Gas**: Sufficient ETH for deployment (0.5-2 ETH)
- **Verification**: Etherscan API key
- **Monitoring**: Block explorer integration

### Recommended Cloud Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend     │    │     CDN        │    │   Load Balancer │
│  (Vercel/     │────│  (Cloudflare)  │────│   (AWS ALB)    │
│   Netlify)      │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Monitoring    │    │     Database    │    │   Backend       │
│ (DataDog/      │────│   (RDS/        │────│  (AWS ECS/     │
│  New Relic)    │    │   DocumentDB)   │    │   Heroku)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Email        │    │   File Storage  │    │   Smart        │
│  (SendGrid/    │────│   (S3/Cloud    │────│   Contracts     │
│    SES)        │    │    Storage)     │    │  (Mainnet)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Environment Configuration

### Production Environment Variables

Create `.env.production` file with the following variables:

#### Frontend Environment
```bash
# Application
REACT_APP_ENV=production
REACT_APP_API_URL=https://api.healthcare-drips.com
REACT_APP_WS_URL=wss://api.healthcare-drips.com
REACT_APP_NETWORK_ID=1
REACT_APP_CONTRACT_ADDRESS=0x...

# Analytics
REACT_APP_GA_TRACKING_ID=G-XXXXXXXXXX
REACT_APP_HOTJAR_ID=XXXXXX
REACT_APP_SENTRY_DSN=https://...@sentry.io/...

# Third-party
REACT_APP_MAPBOX_TOKEN=pk.xxxxxx
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
REACT_APP_SENTRY_ENVIRONMENT=production
```

#### Backend Environment
```bash
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:pass@host:5432/healthcare_drips
DB_SSL=true
DB_POOL_SIZE=20

# Authentication
JWT_SECRET=your-super-secret-jwt-key-256-bits
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# Blockchain
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
ETHEREUM_PRIVATE_KEY=your-encrypted-private-key
CONTRACT_ADDRESS=0x...
WALLET_PRIVATE_KEY=your-encrypted-wallet-key

# Email
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=SG.xxxxxx
FROM_EMAIL=noreply@healthcare-drips.com

# File Storage
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=healthcare-drips-files
AWS_REGION=us-east-1

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
DATADOG_API_KEY=...
NEW_RELIC_LICENSE_KEY=...

# Security
CORS_ORIGIN=https://healthcare-drips.com
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Environment-Specific Configurations

#### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_ANALYTICS=false
```

#### Staging
```bash
NODE_ENV=staging
LOG_LEVEL=info
ENABLE_ANALYTICS=true
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

#### Production
```bash
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_ANALYTICS=true
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Security Setup

### SSL/TLS Configuration

#### Frontend SSL
```bash
# Cloudflare SSL Configuration
- SSL/TLS Encryption Mode: Full (Strict)
- Minimum TLS Version: TLS 1.2
- HSTS: Enable with max-age=31536000
- Opportunistic Encryption: On
- TLS 1.3: Enable
- HTTP/3: Enable
```

#### Backend SSL
```nginx
# Nginx SSL Configuration
server {
    listen 443 ssl http2;
    server_name api.healthcare-drips.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https: wss:;" always;
}
```

### Firewall Configuration

#### AWS Security Groups
```json
{
  "SecurityGroups": [
    {
      "GroupName": "healthcare-backend-sg",
      "Description": "Security group for backend servers",
      "IngressRules": [
        {
          "IpProtocol": "tcp",
          "FromPort": 443,
          "ToPort": 443,
          "IpRanges": ["0.0.0.0/0"],
          "Description": "HTTPS"
        },
        {
          "IpProtocol": "tcp",
          "FromPort": 80,
          "ToPort": 80,
          "IpRanges": ["0.0.0.0/0"],
          "Description": "HTTP redirect"
        }
      ],
      "EgressRules": [
        {
          "IpProtocol": "-1",
          "IpRanges": ["0.0.0.0/0"],
          "Description": "All outbound traffic"
        }
      ]
    }
  ]
}
```

### Database Security

#### PostgreSQL Security Configuration
```sql
-- Enable SSL connections
ALTER SYSTEM SET ssl = 'on';
ALTER SYSTEM SET ssl_cert_file = '/path/to/server.crt';
ALTER SYSTEM SET ssl_key_file = '/path/to/server.key';

-- Restrict connections
ALTER SYSTEM SET listen_addresses = 'localhost,10.0.0.1';
ALTER SYSTEM SET max_connections = 100;

-- Enable auditing
CREATE EXTENSION IF NOT EXISTS pgaudit;
ALTER SYSTEM SET pgaudit.log = 'all';
ALTER SYSTEM SET pgaudit.log_catalog = 'on';
```

## Frontend Deployment

### Option 1: Vercel (Recommended)

#### Prerequisites
- Vercel account
- Domain configured in Vercel
- Environment variables set in Vercel dashboard

#### Deployment Steps
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy to production
cd frontend
vercel --prod

# 4. Configure domain
vercel domains add healthcare-drips.com

# 5. Set environment variables
vercel env add REACT_APP_API_URL
vercel env add REACT_APP_NETWORK_ID
vercel env add REACT_APP_CONTRACT_ADDRESS
```

#### Vercel Configuration
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

### Option 2: Netlify

#### Deployment Steps
```bash
# 1. Install Netlify CLI
npm i -g netlify-cli

# 2. Build and deploy
cd frontend
npm run build
netlify deploy --prod --dir=build

# 3. Configure domain
netlify domains add healthcare-drips.com

# 4. Set up redirects
echo "/*    /index.html   200" > _redirects
netlify deploy --prod --dir=build
```

#### Netlify Configuration
```toml
# netlify.toml
[build]
  publish = "build"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Backend Deployment

### Option 1: AWS ECS (Recommended)

#### Prerequisites
- AWS CLI configured
- Docker installed
- ECS cluster created
- RDS database instance

#### Dockerfile
```dockerfile
# backend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]
```

#### ECS Task Definition
```json
{
  "family": "healthcare-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "healthcare-backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/healthcare-backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:healthcare-db-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:healthcare-jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/healthcare-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Deployment Script
```bash
#!/bin/bash
# deploy-backend.sh

# Build and push Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker build -t healthcare-backend ./backend
docker tag healthcare-backend:latest your-account.dkr.ecr.us-east-1.amazonaws.com/healthcare-backend:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/healthcare-backend:latest

# Update ECS service
aws ecs update-service --cluster healthcare-cluster --service healthcare-backend --force-new-deployment

# Wait for deployment to complete
aws ecs wait services-stable --cluster healthcare-cluster --services healthcare-backend
```

### Option 2: Heroku

#### Deployment Steps
```bash
# 1. Install Heroku CLI
# 2. Login to Heroku
heroku login

# 3. Create app
heroku create healthcare-drips-api --region us

# 4. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set DATABASE_URL=postgresql://...
heroku config:set JWT_SECRET=your-secret

# 5. Deploy
cd backend
heroku git:remote -a healthcare-drips-api
git subtree push --prefix backend heroku main
```

#### Heroku Configuration
```json
{
  "name": "healthcare-drips-api",
  "buildpacks": [
    "heroku/nodejs"
  ],
  "env": {
    "NODE_ENV": "production",
    "NPM_CONFIG_PRODUCTION": "false"
  },
  "formation": {
    "web": {
      "quantity": 1,
      "size": "standard-2x"
    }
  },
  "addons": [
    "heroku-postgresql:hobby-dev",
    "heroku-redis:hobby-dev"
  ]
}
```

## Smart Contract Deployment

### Pre-Deployment Checklist

#### Security Audit
```bash
# Run security analysis
npm install -g mythril
myth analyze contracts/HealthcareDrips.sol

# Run Slither analysis
pip install slither-analyzer
slither contracts/HealthcareDrips.sol

# Run comprehensive tests
npx hardhat test --coverage
npx hardhat coverage
```

#### Gas Optimization
```solidity
// Before optimization
function expensiveFunction(uint[] memory data) public {
    for (uint i = 0; i < data.length; i++) {
        // Expensive operations in loop
    }
}

// After optimization
function optimizedFunction(uint[] calldata data) public {
    uint length = data.length;
    for (uint i = 0; i < length; i++) {
        // Optimized operations
    }
}
```

### Mainnet Deployment

#### Hardhat Deployment Script
```javascript
// scripts/deploy-mainnet.js
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Deploying HealthcareDrips to mainnet...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  // Deploy contract
  const HealthcareDrips = await ethers.getContractFactory("HealthcareDrips");
  const healthcareDrips = await HealthcareDrips.deploy();
  
  await healthcareDrips.deployed();
  console.log("HealthcareDrips deployed to:", healthcareDrips.address);
  
  // Verify on Etherscan
  console.log("Verifying contract on Etherscan...");
  try {
    await hre.run("verify:verify", {
      address: healthcareDrips.address,
      constructorArguments: [],
    });
    console.log("Contract verified successfully!");
  } catch (error) {
    console.log("Contract verification failed:", error);
  }
  
  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "mainnet",
    contractAddress: healthcareDrips.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    gasUsed: (await healthcareDrips.deployTransaction.wait()).gasUsed.toString()
  };
  
  fs.writeFileSync(
    `deployments/mainnet-${new Date().toISOString().split('T')[0]}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

#### Deployment Commands
```bash
# 1. Compile contracts
npx hardhat compile

# 2. Run tests
npx hardhat test

# 3. Deploy to mainnet
npx hardhat run scripts/deploy-mainnet.js --network mainnet

# 4. Verify contracts
npx hardhat verify --network mainnet <CONTRACT_ADDRESS>
```

### Contract Verification

#### Etherscan API Configuration
```javascript
// hardhat.config.js
module.exports = {
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  networks: {
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 20000000000, // 20 gwei
      gas: 6000000,
    },
  },
};
```

## Database Setup

### PostgreSQL Production Setup

#### RDS Instance Configuration
```bash
# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier healthcare-drips-db \
    --db-instance-class db.m5.large \
    --engine postgres \
    --engine-version 14.9 \
    --master-username healthcare_admin \
    --master-user-password your-secure-password \
    --allocated-storage 100 \
    --storage-type gp2 \
    --storage-encrypted \
    --vpc-security-group-ids sg-xxxxxxxxx \
    --db-subnet-group-name default \
    --backup-retention-period 7 \
    --multi-az \
    --publicly-accessible \
    --region us-east-1
```

#### Database Configuration
```sql
-- Create database
CREATE DATABASE healthcare_drips;
CREATE USER healthcare_app WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE healthcare_drips TO healthcare_app;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes
CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_providers_specialty ON providers(specialty);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_premiums_patient_id ON premium_drips(patient_id);

-- Configure performance
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
```

#### Connection Pool Setup
```javascript
// backend/src/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

### Backup Strategy

#### Automated Backups
```bash
#!/bin/bash
# backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="healthcare_drips_backup_$DATE.sql"

# Create backup
pg_dump $DATABASE_URL > /backups/$BACKUP_FILE

# Compress backup
gzip /backups/$BACKUP_FILE

# Upload to S3
aws s3 cp /backups/$BACKUP_FILE.gz s3://healthcare-drips-backups/

# Clean up local files (keep last 7 days)
find /backups -name "*.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

#### Cron Job for Backups
```bash
# Add to crontab
0 2 * * * /path/to/backup-database.sh >> /var/log/backup.log 2>&1
```

## Monitoring & Logging

### Application Monitoring

#### DataDog Setup
```javascript
// backend/src/monitoring/datadog.js
const datadog = require('datadog-metrics');
const metrics = new datadog.Meter({
  apiKey: process.env.DATADOG_API_KEY,
  host: 'healthcare-drips-api',
});

// Custom metrics
metrics.increment('api.requests', 1, ['method:GET', 'endpoint:/api/patients']);
metrics.gauge('api.response_time', 150, ['endpoint:/api/patients']);
metrics.histogram('database.query_time', 25, ['table:patients']);
```

#### Health Check Endpoints
```javascript
// backend/src/routes/health.js
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    checks: {
      database: 'connected',
      blockchain: 'connected',
      redis: 'connected'
    }
  };
  res.status(200).json(health);
});

app.get('/health/ready', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    // Check blockchain connection
    await provider.getNetwork();
    
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

### Error Tracking

#### Sentry Configuration
```javascript
// backend/src/monitoring/sentry.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Error handling middleware
app.use(Sentry.Handlers.errorHandler());

// Request handler
app.use(Sentry.Handlers.requestHandler());
```

### Log Management

#### Winston Logger Configuration
```javascript
// backend/src/config/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: |
          cd frontend && npm ci
          cd ../backend && npm ci
          
      - name: Run tests
        run: |
          cd frontend && npm test -- --coverage
          cd ../backend && npm test -- --coverage
          
      - name: Build applications
        run: |
          cd frontend && npm run build
          cd ../backend && npm run build
          
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            frontend/build
            backend/dist

  deploy-frontend:
    needs: test-and-build
    runs-on: ubuntu-latest
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend/build

  deploy-backend:
    needs: test-and-build
    runs-on: ubuntu-latest
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster healthcare-cluster --service healthcare-backend --force-new-deployment
          
      - name: Run health check
        run: |
          sleep 30
          curl -f https://api.healthcare-drips.com/health || exit 1

  deploy-contracts:
    needs: test-and-build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd contracts && npm ci
          
      - name: Deploy contracts
        run: |
          cd contracts
          npx hardhat run scripts/deploy-mainnet.js --network mainnet
        env:
          MAINNET_RPC_URL: ${{ secrets.MAINNET_RPC_URL }}
          PRIVATE_KEY: ${{ secrets.DEPLOYER_PRIVATE_KEY }}
          ETHERSCAN_API_KEY: ${{ secrets.ETHERSCAN_API_KEY }}
```

## Post-Deployment Checklist

### Security Verification
- [ ] SSL certificates are valid and properly configured
- [ ] Security headers are present and correct
- [ ] Firewall rules are restrictive and appropriate
- [ ] Database connections are encrypted
- [ ] API keys and secrets are properly secured
- [ ] CORS policies are correctly configured
- [ ] Rate limiting is enabled and tested

### Performance Verification
- [ ] Page load times are under 3 seconds
- [ ] API response times are under 500ms
- [ ] Database queries are optimized
- [ ] CDN is properly caching static assets
- [ ] Images are optimized and compressed
- [ ] Gzip compression is enabled

### Functionality Verification
- [ ] User registration and login work correctly
- [ ] Provider search and filtering function properly
- [ ] Appointment booking system works
- [ ] Payment processing is functional
- [ ] Smart contract interactions work correctly
- [ ] Email notifications are sent
- [ ] File uploads and downloads work

### Monitoring Setup
- [ ] Application monitoring is configured
- [ ] Error tracking is active and receiving data
- [ ] Log aggregation is working
- [ ] Performance metrics are being collected
- [ ] Uptime monitoring is configured
- [ ] Database monitoring is active
- [ ] Security alerts are configured

## Troubleshooting

### Common Issues

#### Frontend Deployment Issues
```bash
# Build fails
npm run build

# Check for missing dependencies
npm ls --depth=0

# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Backend Deployment Issues
```bash
# Database connection fails
# Check connection string
echo $DATABASE_URL

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check SSL configuration
openssl s_client -connect api.healthcare-drips.com:443
```

#### Smart Contract Deployment Issues
```bash
# Gas estimation fails
npx hardhat run scripts/estimate-gas.js

# Contract verification fails
# Check constructor arguments
npx hardhat verify --network mainnet <ADDRESS> '<CONSTRUCTOR_ARGS>'

# Transaction stuck
# Check gas price
curl https://ethgasstation.info/api/ethgasAPI.json
```

### Performance Issues

#### Slow API Response
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats_ext
WHERE correlation > 0.9;
```

#### High Memory Usage
```bash
# Check memory usage
free -h
top -p $(pgrep node)

# Check Node.js memory leaks
node --inspect app.js
# In Chrome DevTools: Memory > Take heap snapshot
```

### Security Issues

#### SSL Certificate Problems
```bash
# Check certificate validity
openssl x509 -in /path/to/certificate.crt -text -noout

# Check certificate chain
openssl s_client -connect api.healthcare-drips.com:443 -showcerts

# Test SSL configuration
nmap --script ssl-enum-ciphers -p 443 api.healthcare-drips.com
```

#### Database Security
```sql
-- Check for unauthorized access
SELECT usename, application_name, client_addr, state 
FROM pg_stat_activity 
WHERE state = 'active';

-- Check for privilege escalation
SELECT grantee, grantor, table_name, privilege_type 
FROM information_schema.table_privileges;
```

### Emergency Procedures

#### Database Recovery
```bash
# Restore from backup
gunzip /backups/healthcare_drips_backup_20240325.sql.gz
psql $DATABASE_URL < /backups/healthcare_drips_backup_20240325.sql

# Point-in-time recovery (PostgreSQL)
pg_basebackup -h localhost -D /backup/base -U postgres -v -P
```

#### Contract Emergency Pause
```solidity
// Emergency pause function
bool public paused = false;

modifier whenNotPaused() {
    require(!paused, "Contract is paused");
    _;
}

function emergencyPause() external onlyOwner {
    paused = true;
    emit EmergencyPaused(msg.sender);
}
```

---

## 📞 Support

For deployment assistance:
- **Documentation**: [Deployment Wiki](https://github.com/your-org/health-care/wiki/Deployment)
- **Issues**: [GitHub Issues](https://github.com/your-org/health-care/issues)
- **Discord**: [#deployment-support](https://discord.gg/your-server)
- **Email**: deploy@healthcare-drips.com

## 🔐 Security

For security concerns during deployment:
- **Security Team**: security@healthcare-drips.com
- **PGP Key**: Available on request
- **Security Policy**: [SECURITY.md](./SECURITY.md)

---

**⚠️ Always test deployments in a staging environment before deploying to production.**
