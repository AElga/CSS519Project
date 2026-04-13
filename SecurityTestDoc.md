# Security Test Document  
**Project:** ElgHealth – HealthTech Appointment Management Web Application 
**Date:** 04/11/2026 
**Version:** 1.0  

---

# 1. Introduction

## 1.1 Purpose
This document defines the initial security testing strategy for ElgHealth. The goal is to identify vulnerabilities, validate security controls, and ensure the protection of sensitive patient data (PII and PHI).

## 1.2 Scope
Security testing applies to all major system components:

- Frontend (web interface)
- Backend API services
- Database systems
- Authentication and authorization mechanisms

## 1.3 Objectives
- Identify and mitigate common web application vulnerabilities such as SQL Injection
- Validate compliance with HIPPA and security requirements defined in the design document
- Ensure confidentiality, integrity, and availability of PHI

---

# 2. System Overview (Security Perspective)

- **Frontend:** User interaction layer for patients and doctors  
- **Backend:** API handling authentication, appointments, and medical records  
- **Database:** Stores sensitive PHI  

Sensitive assets include:
- User credentials
- Personally Identifiable Information (PII)
- Medical records (lab results, prescriptions, notes)

---

# 3. Security Requirements

| Requirement | Description |
|------------|------------|
| Authentication | Secure login and registration with hashed and salted passwords and MFA|
| Authorization | Role-based access (Doctor vs Patient) |
| Data Protection | Encryption in transit and at rest with industry standard algorithms (AES/SHA)|
| Input Validation | Prevent malicious input from users such as SQL injection|
| Auditability | Track access and changes to records through logging|

---

# 4. Security Test Strategy

## 4.1 Testing Types

### 4.1.1 Authentication Testing
- Test password hashing strength/corectness
- Test brute-force protection (such as password spraying)
- Validate session management (timeouts, token handling)

### 4.1.2 Authorization Testing
- Verify role-based access control (RBAC)
- Ensure patients cannot access other patients' records
- Ensure only doctors can modify medical records

### 4.1.3 Input Validation Testing
- Test for:
  - SQL Injection
  - Cross-Site Scripting (XSS)
  - Command Injection
- Validate all user inputs (forms, API requests)

### 4.1.4 Data Protection Testing
- Verify HTTPS enforcement (TLS) against known attacks
- Ensure encryption of sensitive data at rest
- Validate secure password hashing (e.g., bcrypt)

### 4.1.5 API Security Testing
- Test all endpoints for:
  - Authentication bypass and Improper authorization
  - Data leakage
- Validate rate limiting and throttling

### 4.1.6 Session Management Testing
- Test session token expiration and hijacking protection
- Ensure secure cookies (HttpOnly, Secure flags)

### 4.1.7 Logging and Monitoring
- Verify logging of:
  - Login attempts
  - Record access/modification
- Ensure logs cannot be tampered with by any user

---

# 5. Test Environment

- Local development environment
- Staging environment with mock data
- Tools:
  - Burp Suite / OWASP ZAP
  - Postman (API testing)
  - Browser DevTools

---

# 6. Test Cases (Initial)

| ID | Test Case | Description | Expected Result |
|----|----------|------------|----------------|
| ST-01 | Login Authentication | Attempt login with valid/invalid credentials | Only valid credentials succeed |
| ST-02 | SQL Injection | Inject SQL into login fields | Input is sanitized, no DB compromise |
| ST-03 | Unauthorized Access | Patient accesses another patient's records | Access denied |
| ST-04 | Role Escalation | Patient attempts doctor actions | Access denied |
| ST-05 | Data Encryption | Inspect network traffic | Data is encrypted (HTTPS) |
| ST-06 | Session Timeout | Leave session idle | Session expires after timeout |

---

# 8. Future Enhancements

- Advanced threat modeling (detailed STRIDE analysis)
- Security incident response plan

---
