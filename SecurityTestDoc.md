# Security Test Document  
**Project:** ElgHealth – HealthTech Appointment Management Web Application 
**Date:** 04/11/2026 
**Version:** 1.0  

---

# 1. Introduction

## 1.1 Purpose
This document defines the initial security testing strategy for the ElgHealth web application. The goal is to identify vulnerabilities, validate security controls, and ensure the protection of sensitive patient data (PII and medical records).

## 1.2 Scope
Security testing applies to all major system components:

- Frontend (web interface)
- Backend API services
- Database systems
- Authentication and authorization mechanisms

## 1.3 Objectives
- Ensure confidentiality, integrity, and availability (CIA) of system data
- Validate compliance with security requirements defined in the design document
- Identify and mitigate common web application vulnerabilities

---

# 2. System Overview (Security Perspective)

ElgHealth is a web-based system with:

- **Frontend:** User interaction layer for patients and doctors  
- **Backend:** API handling authentication, appointments, and medical records  
- **Database:** Stores sensitive user and health data  

Sensitive assets include:
- User credentials
- Personally Identifiable Information (PII)
- Medical records (lab results, prescriptions, notes)

---

# 3. Security Requirements Mapping

| Requirement | Description |
|------------|------------|
| Authentication | Secure login and registration |
| Authorization | Role-based access (Doctor vs Patient) |
| Data Protection | Encryption in transit and at rest |
| Input Validation | Prevent malicious input |
| Auditability | Track access and changes to records |

---

# 4. Threat Model Overview (High-Level)

| Threat Category | Example Risks |
|----------------|-------------|
| Spoofing | Unauthorized login attempts |
| Tampering | Modification of medical records |
| Repudiation | Lack of activity logging |
| Information Disclosure | Exposure of patient data |
| Denial of Service | Overloading API endpoints |
| Elevation of Privilege | Patient accessing doctor functions |

---

# 5. Security Test Strategy

## 5.1 Testing Types

### 5.1.1 Authentication Testing
- Verify secure login and registration
- Test password strength enforcement
- Test brute-force protection
- Validate session management (timeouts, token handling)

### 5.1.2 Authorization Testing
- Verify role-based access control (RBAC)
- Ensure patients cannot access other patients' records
- Ensure only doctors can modify medical records

### 5.1.3 Input Validation Testing
- Test for:
  - SQL Injection
  - Cross-Site Scripting (XSS)
  - Command Injection
- Validate all user inputs (forms, API requests)

### 5.1.4 Data Protection Testing
- Verify HTTPS enforcement (TLS)
- Ensure encryption of sensitive data at rest
- Validate secure password hashing (e.g., bcrypt)

### 5.1.5 API Security Testing
- Test all endpoints for:
  - Authentication bypass
  - Improper authorization
  - Data leakage
- Validate rate limiting and throttling

### 5.1.6 Session Management Testing
- Test session expiration
- Test session hijacking protection
- Ensure secure cookies (HttpOnly, Secure flags)

### 5.1.7 Logging and Monitoring
- Verify logging of:
  - Login attempts
  - Record access/modification
- Ensure logs cannot be tampered with

---

# 6. Test Environment

- Local development environment
- Staging environment with mock data
- Tools:
  - Burp Suite / OWASP ZAP
  - Postman (API testing)
  - Browser DevTools

---

# 7. Test Cases (Initial)

| ID | Test Case | Description | Expected Result |
|----|----------|------------|----------------|
| ST-01 | Login Authentication | Attempt login with valid/invalid credentials | Only valid credentials succeed |
| ST-02 | SQL Injection | Inject SQL into login fields | Input is sanitized, no DB compromise |
| ST-03 | Unauthorized Access | Patient accesses another patient's records | Access denied |
| ST-04 | Role Escalation | Patient attempts doctor actions | Access denied |
| ST-05 | Data Encryption | Inspect network traffic | Data is encrypted (HTTPS) |
| ST-06 | Session Timeout | Leave session idle | Session expires after timeout |
| ST-07 | XSS Attack | Inject script into input fields | Script is not executed |

---

# 8. Tools and Automation

- **Static Analysis:** Code scanning tools (e.g., SonarQube)
- **Dynamic Analysis:** OWASP ZAP, Burp Suite
- **Dependency Scanning:** npm audit, Snyk
- **CI/CD Integration:** Automated security tests in pipeline

---

# 9. Risks and Assumptions

## Risks
- Handling of highly sensitive medical data increases impact of breaches
- Improper access control could expose patient records

## Assumptions
- HTTPS will be enforced across all environments
- Secure coding practices will be followed

---

# 10. Future Enhancements

- Penetration testing by third-party security experts
- Compliance validation (e.g., HIPAA)
- Advanced threat modeling (detailed STRIDE analysis)
- Security incident response plan

---

# 11. Approval

| Role | Name | Signature | Date |
|------|------|----------|------|
| Project Owner |  |  |  |
| Security Lead |  |  |  |

---
