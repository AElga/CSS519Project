# Threat Model Document (STRIDE)
**Project:** ElgHealth – HealthTech Appointment Management Web Application   
**Date:** 04/11/2026  
**Version:** 1.0  

---

# 1. Overview

This document outlines the threat model for the ElgHealth system using the STRIDE framework. The goal is to identify potential security threats and propose mitigations to protect sensitive healthcare data, ensure system integrity, and maintain user trust.

---

# 2. System Components

- **Frontend:** Web interface (patients & doctors)
- **Backend:** API server handling business logic
- **Database:** Stores users, appointments, and medical records
- **Authentication System:** Handles login and identity verification

---

# 3. Assets

| Asset | Description |
|------|------------|
| User Credentials | Emails, passwords |
| Patient Records | Lab results, prescriptions, medical notes |
| Appointment Data | Scheduling and doctor-patient relationships |
| System Availability | Continuous uptime (99.95%) |
| Audit Logs | Record of system activity |

---

# 4. STRIDE Threat Analysis

## 4.1 Spoofing Identity

### Threats
- Unauthorized users impersonating patients or doctors
- Credential stuffing or brute-force login attempts
- Session hijacking

### Affected Components
- Authentication system
- Backend API

### Mitigations
- Multi-Factor Authentication (MFA)
- Strong password policies (length, complexity)
- Secure session management (HTTP-only, secure cookies)
- Rate limiting and account lockouts
- OAuth or token-based authentication (e.g., JWT with expiration)

---

## 4.2 Tampering with Data

### Threats
- Modification of medical records or prescriptions
- SQL injection attacks on backend/database
- API request manipulation

### Affected Components
- Backend API
- Database

### Mitigations
- Input validation and sanitization
- Use of prepared statements / ORM
- HTTPS encryption (TLS 1.2+)
- Integrity checks (hashing, digital signatures)
- Role-based access control (RBAC)

---

## 4.3 Repudiation

### Threats
- Users denying actions (e.g., doctors denying record updates)
- Lack of traceability for changes

### Affected Components
- Backend
- Database

### Mitigations
- Audit logging of all critical actions
- Timestamped logs with user IDs
- Immutable logs (append-only storage)
- Log monitoring and alerting

---

## 4.4 Information Disclosure

### Threats
- Exposure of sensitive patient data (PII, PHI)
- Data leaks due to misconfigured APIs
- Insecure data transmission

### Affected Components
- Frontend
- Backend
- Database

### Mitigations
- Encryption at rest (AES-256)
- Encryption in transit (TLS)
- Strict access control policies
- Data masking where applicable
- Secure API design (no over-fetching of data)
- Regular security audits and penetration testing

---

## 4.5 Denial of Service (DoS)

### Threats
- Overloading system with traffic
- API abuse
- Resource exhaustion attacks

### Affected Components
- Backend API
- Infrastructure

### Mitigations
- Rate limiting and throttling
- Load balancing
- Auto-scaling infrastructure
- Web Application Firewall (WAF)
- Monitoring and alerting systems

---

## 4.6 Elevation of Privilege

### Threats
- Patients gaining doctor-level access
- Unauthorized access to restricted endpoints
- Exploiting vulnerabilities for admin privileges

### Affected Components
- Backend API
- Authentication/Authorization system

### Mitigations
- Strict Role-Based Access Control (RBAC)
- Principle of Least Privilege
- Backend authorization checks (not just frontend)
- Regular security testing (e.g., privilege escalation tests)

---

# 5. Data Flow Considerations

### Key Flows
1. User login → Authentication → Token issued  
2. Patient schedules appointment → Backend → Database  
3. Doctor updates medical record → Backend → Database  
4. Patient retrieves records → Backend → Frontend  

### Security Controls
- All flows must use HTTPS
- Tokens must be validated on every request
- Sensitive operations require re-authentication (optional)

---

# 6. Assumptions

- Users access system via modern browsers
- Backend is hosted in a secure cloud environment
- Database access is restricted to backend only
- No direct client-to-database communication

---

# 7. Residual Risks

- Zero-day vulnerabilities
- Insider threats (malicious doctors/admins)
- Misconfiguration of cloud services
- Third-party dependency risks

---

# 8. Recommendations

- Conduct regular penetration testing
- Implement continuous security monitoring (SIEM)
- Enforce HIPAA compliance standards
- Perform dependency vulnerability scanning
- Establish incident response plan

---

# 9. Conclusion

The STRIDE analysis highlights key security risks in authentication, data handling, and access control. By implementing the recommended mitigations, ElgHealth can significantly reduce its attack surface and ensure the confidentiality, integrity, and availability of sensitive healthcare data.

---
