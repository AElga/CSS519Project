# Security Test Document

**Project:** ElgHealth – HealthTech Appointment Management Web Application
**Version:** 1.0
**Date:** 04/26/2026

---

This document covers example security/functionality tests based on the current threat model.

Parts of the project covered by this test document include:

* Authentication and authorization mechanisms
* API and backend security
* Data protection and privacy controls
* Logging and monitoring
* System resilience against abuse (e.g., DoS)

---

# 1. Test Objectives

* Validate that all identified STRIDE threats are mitigated
* Ensure proper enforcement of authentication and authorization
* Detect vulnerabilities such as SQL injection, broken access control, and data leaks
* Verify system behavior under malicious or unexpected inputs
* Confirm compliance with healthcare security expectations (e.g., HIPAA-aligned practices)

---

# 2. Test Environment

| Component | Description                          |
| --------- | ------------------------------------ |
| Frontend  | Web application (browser-based), HTML|
| Backend   | Node.js                              |
| Database  | SQLite database                      |
| Auth      | RBAC and JWT authentication          |
| Tools     | "Jest, Supertest, Postman, OWASP ZAP"|

---

# 3. Test Cases by STRIDE Category

Note: These test cases are general javascript and are not intended to reflect the exact test case that will be within the project.

---

## 3.1 Spoofing Identity

### Test Case S-1: Valid Login

* **Type:** Functional
* **Description:** Verify valid users can authenticate
* **Steps:**

  1. Submit valid credentials
* **Expected Result:** 200 OK, JWT returned

```javascript
test('Valid login should succeed', async () => {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'patient@example.com', password: 'Password123!' });

  expect(res.statusCode).toBe(200);
  expect(res.body.token).toBeDefined();
});
```

---

### Test Case S-2: Invalid Login

* **Type:** Security
* **Expected Result:** 401 Unauthorized

```javascript
test('Invalid login should fail', async () => {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'patient@example.com', password: 'wrong' });

  expect(res.statusCode).toBe(401);
});
```

---

## 3.2 Tampering with Data

### Test Case T-1: SQL Injection

* **Type:** Security
* **Expected Result:** Request rejected

```javascript
test('SQL injection attempt should fail', async () => {
  const res = await request(app)
    .post('/api/login')
    .send({
      email: "' OR 1=1 --",
      password: "anything"
    });

  expect(res.statusCode).toBe(401);
});
```

---

## 3.3 Repudiation

### Test Case R-1: Audit Logging

* **Type:** Functional
* **Expected Result:** Action logged with user + timestamp

```javascript
const fs = require('fs');

test('Login action should be logged', async () => {
  await request(app)
    .post('/api/login')
    .send({ email: 'patient@example.com', password: 'Password123!' });

  const logs = fs.readFileSync('./logs/audit.log', 'utf-8');
  expect(logs).toMatch(/patient@example.com/);
});
```

---

## 3.4 Information Disclosure

### Test Case I-1: Access Control Enforcement

* **Type:** Security
* **Expected Result:** 403 Forbidden

```javascript
test('User cannot access another user data', async () => {
  const token = 'valid_patient_token';

  const res = await request(app)
    .get('/api/patient/another-user-id')
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(403);
});
```

---

## 3.5 Denial of Service (DoS)

### Test Case D-1: Large Payload Handling

* **Type:** Security
* **Expected Result:** Request rejected

```javascript
test('Large payload should be rejected', async () => {
  const largePayload = 'A'.repeat(10_000_000);

  const res = await request(app)
    .post('/api/data')
    .send({ data: largePayload });

  expect(res.statusCode).toBeGreaterThanOrEqual(400);
});
```

---

## 3.6 Elevation of Privilege

### Test Case E-1: Role-Based Access Control

* **Type:** Security
* **Expected Result:** 403 Forbidden

```javascript
test('Patient cannot access doctor endpoint', async () => {
  const res = await request(app)
    .get('/api/doctor/patients')
    .set('Authorization', `Bearer patient_token`);

  expect(res.statusCode).toBe(403);
});
```

---