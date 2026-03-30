// Insurance Provider Portal Dashboard JavaScript

class InsurancePortal {
    constructor() {
        this.apiBase = '/api';
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.charts = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.getAttribute('href').substring(1);
                this.showSection(section);
            });
        });

        // Login form
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
        });

        // Refresh dashboard
        document.getElementById('refreshDashboard')?.addEventListener('click', () => {
            this.loadDashboard();
        });

        // Add policy form
        document.getElementById('addPolicyForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPolicy();
        });

        // Report form
        document.getElementById('reportForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateReport();
        });
    }

    async checkAuth() {
        if (!this.token) {
            this.showLoginModal();
            return;
        }

        try {
            const response = await this.apiCall('/auth/me', 'GET');
            this.currentUser = response.user;
            this.updateUI();
            this.showSection('dashboard');
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showLoginModal();
        }
    }

    showLoginModal() {
        const modal = new bootstrap.Modal(document.getElementById('loginModal'));
        modal.show();
    }

    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await this.apiCall('/auth/login', 'POST', { email, password });
            
            this.token = response.token;
            this.currentUser = response.user;
            localStorage.setItem('token', this.token);

            // Hide login modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
            modal.hide();

            // Update UI and load dashboard
            this.updateUI();
            this.showSection('dashboard');
            
            this.showAlert('Login successful!', 'success');
        } catch (error) {
            this.showAlert('Login failed: ' + error.message, 'error');
        }
    }

    logout() {
        localStorage.removeItem('token');
        this.token = null;
        this.currentUser = null;
        this.showLoginModal();
    }

    updateUI() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.username;
        }
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });

        // Show selected section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`.nav-link[href="#${sectionName}"]`)?.classList.add('active');

        // Load section data
        this.loadSectionData(sectionName);
    }

    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'policies':
                await this.loadPolicies();
                break;
            case 'claims':
                await this.loadClaims();
                break;
            case 'payments':
                await this.loadPayments();
                break;
            case 'reports':
                await this.loadReports();
                break;
        }
    }

    async loadDashboard() {
        try {
            const response = await this.apiCall('/reports/dashboard?period=month');
            const data = response;

            // Update stats cards
            document.getElementById('totalPolicies').textContent = data.summary.totalPolicies || 0;
            document.getElementById('activeClaims').textContent = data.summary.totalClaims || 0;
            document.getElementById('monthlyRevenue').textContent = this.formatCurrency(data.summary.totalPremium || 0);
            document.getElementById('pendingTasks').textContent = data.claimStats.find(s => s._id === 'under_review')?.count || 0;

            // Update charts
            this.updateCharts(data);
            
            // Load recent activities
            await this.loadRecentActivities();
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showAlert('Failed to load dashboard data', 'error');
        }
    }

    updateCharts(data) {
        // Claims overview chart
        const claimsCtx = document.getElementById('claimsChart');
        if (claimsCtx) {
            if (this.charts.claims) {
                this.charts.claims.destroy();
            }

            this.charts.claims = new Chart(claimsCtx, {
                type: 'line',
                data: {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                    datasets: [{
                        label: 'New Claims',
                        data: [12, 19, 8, 15],
                        borderColor: '#4e73df',
                        backgroundColor: 'rgba(78, 115, 223, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Approved Claims',
                        data: [8, 15, 12, 10],
                        borderColor: '#1cc88a',
                        backgroundColor: 'rgba(28, 200, 138, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    }
                }
            });
        }

        // Claim status chart
        const statusCtx = document.getElementById('claimStatusChart');
        if (statusCtx) {
            if (this.charts.status) {
                this.charts.status.destroy();
            }

            const statusData = data.claimStats || [];
            this.charts.status = new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: statusData.map(s => s._id),
                    datasets: [{
                        data: statusData.map(s => s.count),
                        backgroundColor: [
                            '#4e73df',
                            '#1cc88a',
                            '#36b9cc',
                            '#f6c23e',
                            '#e74a3b'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                        }
                    }
                }
            });
        }
    }

    async loadRecentActivities() {
        try {
            const response = await this.apiCall('/audit/logs?limit=10');
            const activities = response.logs;

            const tbody = document.querySelector('#recentActivities tbody');
            tbody.innerHTML = '';

            activities.forEach(activity => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(activity.details.timestamp).toLocaleDateString()}</td>
                    <td>${activity.action}</td>
                    <td>${activity.resourceType} - ${activity.resourceId}</td>
                    <td><span class="status-badge status-${activity.outcome}">${activity.outcome}</span></td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to load recent activities:', error);
        }
    }

    async loadPolicies() {
        try {
            const response = await this.apiCall('/policies');
            const policies = response.policies;

            const tbody = document.querySelector('#policiesTable tbody');
            tbody.innerHTML = '';

            policies.forEach(policy => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${policy.policyNumber}</td>
                    <td>${policy.policyHolder.firstName} ${policy.policyHolder.lastName}</td>
                    <td>${policy.policyType}</td>
                    <td>${this.formatCurrency(policy.premium.amount)}</td>
                    <td><span class="status-badge status-${policy.status}">${policy.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary btn-action" onclick="portal.viewPolicy('${policy._id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary btn-action" onclick="portal.editPolicy('${policy._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to load policies:', error);
            this.showAlert('Failed to load policies', 'error');
        }
    }

    async loadClaims() {
        try {
            const response = await this.apiCall('/claims');
            const claims = response.claims;

            const tbody = document.querySelector('#claimsTable tbody');
            tbody.innerHTML = '';

            claims.forEach(claim => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${claim.claimNumber}</td>
                    <td>${claim.claimant.name}</td>
                    <td>${claim.claimType}</td>
                    <td>${this.formatCurrency(claim.estimatedAmount)}</td>
                    <td><span class="status-badge status-${claim.status}">${claim.status}</span></td>
                    <td><span class="priority-badge priority-${claim.priority}">${claim.priority}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary btn-action" onclick="portal.viewClaim('${claim._id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-success btn-action" onclick="portal.approveClaim('${claim._id}')">
                            <i class="fas fa-check"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to load claims:', error);
            this.showAlert('Failed to load claims', 'error');
        }
    }

    async loadPayments() {
        try {
            const response = await this.apiCall('/payments');
            const payments = response.payments;

            const tbody = document.querySelector('#paymentsTable tbody');
            tbody.innerHTML = '';

            payments.forEach(payment => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${payment.paymentId}</td>
                    <td>${payment.type}</td>
                    <td>${this.formatCurrency(payment.amount)}</td>
                    <td>${payment.method}</td>
                    <td><span class="status-badge status-${payment.status}">${payment.status}</span></td>
                    <td>${new Date(payment.createdAt).toLocaleDateString()}</td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to load payments:', error);
            this.showAlert('Failed to load payments', 'error');
        }
    }

    async loadReports() {
        try {
            const response = await this.apiCall('/reports/performance');
            const metrics = response;

            const metricsContainer = document.getElementById('performanceMetrics');
            metricsContainer.innerHTML = `
                <div class="row">
                    <div class="col-6">
                        <strong>Avg Processing Time:</strong><br>
                        ${Math.round((metrics.claimMetrics?.avgProcessingTime || 0) / (1000 * 60 * 60))} hours
                    </div>
                    <div class="col-6">
                        <strong>Approval Rate:</strong><br>
                        ${metrics.claimMetrics?.totalClaims > 0 ? 
                            Math.round((metrics.claimMetrics.approvedClaims / metrics.claimMetrics.totalClaims) * 100) : 0}%
                    </div>
                    <div class="col-6 mt-3">
                        <strong>Total Claims:</strong><br>
                        ${metrics.claimMetrics?.totalClaims || 0}
                    </div>
                    <div class="col-6 mt-3">
                        <strong>Rejected Claims:</strong><br>
                        ${metrics.claimMetrics?.rejectedClaims || 0}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Failed to load reports:', error);
            this.showAlert('Failed to load reports', 'error');
        }
    }

    async addPolicy() {
        const formData = {
            policyHolder: {
                firstName: document.getElementById('policyHolderFirstName').value,
                lastName: document.getElementById('policyHolderLastName').value,
                contact: {
                    email: document.getElementById('policyHolderEmail').value,
                    phone: document.getElementById('policyHolderPhone').value
                }
            },
            policyType: document.getElementById('policyType').value,
            premium: {
                amount: parseFloat(document.getElementById('premiumAmount').value),
                frequency: 'monthly'
            },
            term: {
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value
            },
            coverage: {
                // Default coverage - would be more complex in real implementation
                basic: true
            }
        };

        try {
            await this.apiCall('/policies', 'POST', formData);
            
            // Close modal and refresh policies
            const modal = bootstrap.Modal.getInstance(document.getElementById('addPolicyModal'));
            modal.hide();
            
            // Reset form
            document.getElementById('addPolicyForm').reset();
            
            // Reload policies if on policies page
            if (document.getElementById('policies-section').style.display !== 'none') {
                await this.loadPolicies();
            }
            
            this.showAlert('Policy created successfully!', 'success');
        } catch (error) {
            this.showAlert('Failed to create policy: ' + error.message, 'error');
        }
    }

    async generateReport() {
        const reportType = document.getElementById('reportType').value;
        const period = document.getElementById('reportPeriod').value;
        const format = document.getElementById('reportFormat').value;

        try {
            const response = await this.apiCall(`/reports/${reportType}?period=${period}&format=${format}`);
            
            if (format === 'json') {
                // Create blob and download
                const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${reportType}-report-${period}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                // For Excel/PDF, the server would return a file
                window.open(`${this.apiBase}/reports/${reportType}?period=${period}&format=${format}`, '_blank');
            }
            
            this.showAlert('Report generated successfully!', 'success');
        } catch (error) {
            this.showAlert('Failed to generate report: ' + error.message, 'error');
        }
    }

    async apiCall(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(`${this.apiBase}${endpoint}`, config);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    showAlert(message, type = 'info') {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alertDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }

    // Placeholder methods for future implementation
    viewPolicy(id) {
        console.log('View policy:', id);
        // Would open policy details modal
    }

    editPolicy(id) {
        console.log('Edit policy:', id);
        // Would open edit policy modal
    }

    viewClaim(id) {
        console.log('View claim:', id);
        // Would open claim details modal
    }

    approveClaim(id) {
        console.log('Approve claim:', id);
        // Would approve claim
    }
}

// Initialize the portal
const portal = new InsurancePortal();
