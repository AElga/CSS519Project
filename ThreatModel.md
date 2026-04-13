# Threat Model Document (STRIDE)
**Project:** ElgHealth – HealthTech Appointment Management Web Application   
**Date:** 04/11/2026  
**Version:** 1.0  

---

# 1. Overview

This document outlines the threat model for the ElgHealth via the STRIDE framework. The goal is to identify potential security threats and propose mitigations to protect sensitive healthcare data, ensure system integrity, and maintain user trust.

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
| User Credentials | Emails, password hashes |
| Patient Records | Lab results, prescriptions, doctor notes |
| Appointment Data | Scheduling and doctor-patient relationships |
| System Availability | Continuous uptime (99.95%) |
| Audit Logs | Record of system activity |

---

# 4. STRIDE Threat Analysis

## 4.1 Spoofing Identity

### Threats
- Unauthorized users impersonating patients or doctors through phished accounts
- Credential stuffing or brute-force login attempts
- Session hijacking

### Affected Components
- Authentication system
- Backend API
- User Interface/Input Fields

### Mitigations
- Multi-Factor Authentication (MFA)
- Strong password policies (length, complexity)
- Secure session management (HTTP-only, secure cookies)
- Proper password storage (hashing with salt)
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
- Use of prepared statements / ORM against SQLi
- HTTPS encryption (TLS 1.2+)
- Integrity checks (hashing/checksum, digital signatures)
- Role-based access control (RBAC)

---

## 4.3 Repudiation

### Threats
- Lack of traceability for changes/improper accountability

### Affected Components
- Backend
- Database

### Mitigations
- Triage of system activity
- Audit logging of all critical actions
- Timestamped logs with user IDs
- Immutable logs (append-only storage/ROM)

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
- Encryption at rest (AES-256) with HMAC
- Encryption in transit (TLS 2.1)
- Strict access control policies
- Data masking where applicable
- Secure API design (no over-fetching of data, JIT/JER structure)
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

---

## 4.6 Elevation of Privilege

### Threats
- Patients gaining higher-level access
- Unauthorized access to restricted endpoints

### Affected Components
- Backend API
- Authentication/Authorization system

### Mitigations
- Strict Role-Based Access Control (RBAC)
- Principle of Least Privilege
- Backend authorization checks (not just frontend)
- Regular security testing (e.g., privilege escalation tests)
- Zero-Trust when applicable

---

# 5. Assumptions

- Users access system via modern browsers
- Backend is hosted in a secure cloud environment
- Database access is restricted to backend only
- No direct client-to-database communication

---

# 6. Recommendations

- Conduct regular penetration testing
- Implement continuous security monitoring (SIEM)
- Enforce HIPAA compliance standards
- Perform dependency vulnerability scanning
- Establish incident response plan

---
