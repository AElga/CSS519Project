# Technical Design Document
**Project:** HealthTech Appointment Management Web Application  
**Author:**  Ali Elgazzar
**Date:** 04/05/2026
**Version:** 1 

---

# 1. Introduction

ElgHealth, a HealthTech Appointment Management Web Application, aims to be the next bridge between doctors and their patients.

This document describes the technical design for ElgHealth. The system allows patients to schedule medical appointments, access personal health records, request changes to records, and communicate with healthcare providers. Doctors can view their schedules and update patient medical information such as lab results, prescriptions, and medical notes. The purpose of this document is to outline the architecture, system components, and design decisions that will guide the implementation of the application.

## Scope
The system will provide a web-based platform that supports the following functions:

- Patient account creation  
- Appointment scheduling and viewing  
- Doctor access to patient records
- Viewing and updating medical information such as lab results and prescriptions  
- Secure storage and access to patient health data  

The system is intended to be accessible via modern web browsers.

The following table differenciates between Doctor and Patient roles

| Role | Responsibility |
|-----|-----|
| Doctors | Manage patient appointments and medical records |
| Patients | Schedule appointments and view health information |

---

# 2. System Overview

The HealthTech system is a web-based application designed to streamline appointment management and patient record access. The system includes separate interfaces for patients and doctors while maintaining secure storage of medical data.

ElgHealth Architecture:

- **Frontend:** Web interface for patients and doctors  
- **Backend:** API server handling health informaiton and appointments   
- **Database:** Stores user accounts, appointments, and medical records

---

# 3. User Roles

Patients can:

- Register and log into the system
- Schedule appointments
- View upcoming appointments
- Access lab results
- Request updates to information
- View prescriptions and doctor notes

<img width="1136" height="716" alt="image" src="https://github.com/user-attachments/assets/7efc66fc-dacc-4670-9897-ee2afb453ff7" />

Doctors can:

- View upcoming appointments
- Access patient profiles
- View and update information change request
- Add or update:
  - Lab results
  - Medical notes
  - Prescriptions
 
<img width="1099" height="712" alt="image" src="https://github.com/user-attachments/assets/00cec21d-7992-4ed3-8b1b-9f3b42c00ce2" />

---

# 4. Functional Requirements

- User Authentication
   - Users must be able to register and log into the system.
- Appointment Management
   - Patients can view available appointment times.
   - Patients can schedule appointments with doctors.
   - Doctors can view their upcoming appointments.
- Patient Medical Records
   - Doctors can upload lab results.
   - Doctors can add medical notes.
   - Doctors can add prescriptions.
- Patient Access to Records
   - Patients can view: Lab results, Doctor notes, and Prescriptions

---

# 5. Non-Functional Requirements

- Security
   - Medical records and PII must be encrypted during transmission and at rest.
   - Access to patient records must be restricted based on user role.
   - Authentication must prevent unauthorized access.
- Performance and Reliability
   - The system must support high user bandwith at peak traffic times.
   - The system functions must have a latency of no longer than 50 ms
   - The system must have an uptime of 99.95%
 
---

# 6. Data Design

The following table lists the data entities that are considered.

| Entity | Attributes |
|-----|-----|
| Users | user_id : unsigned_int ;   name : string ;   role : int ;   email : string ;   password : hashed_hexadecimal |
| Appointment | appointment_id : unsigned_int ;   patient_id : unsigned_int ;   doctor_id : unsigned_int ;   date : SystemTime() ;   status : string |
| Record | record_id : unsigned_int ;   patient_id : unsigned_int ;   doctor_notes : string ;   prescription : Prescription() ;   lab_results : LabResult() |

Prescription() is defined as: prescription_id : unsigned_int ; name : string ; dosage : string
LabResult() is defined as: result_id : unsigned_int ; result_list : List()

- Relationships
   - One patient can have multiple appointments.
   - One doctor can have multiple patients.
   - Each appointment is associated with one doctor and one patient.

---

# 7. Next Steps

Once this document is reviewd and approved, the development team will begin with the structure of the application flow before setting up functionality and mock data.
