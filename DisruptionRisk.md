# Distruption Risks to ElgHealth Customers

The two distruption risks that are among the highest for a patient management application like ElgHealth are performance/availability and confidentiality/integrity (security).

## Performance/Availability

Performance and availability risks include:

 - Abnormal Latency (Time to send and recieve information is greatly increased)
 - API Unavailability (certain functions do not go through. EX: uploading lab results consistently fail)
 - Unsyncronized data (One role sees some data while another role who should be able to see the same data does not)

Causes of these risks include:

 - CPU, RAM, and Network usage being abnormally high
 - Key servers are offline or in error state (APIs, Database)
 - Database/Services become unsyncronized

## Confidentiality/Integrity

Confidentiality and integrity risks include:

 - Data leakage
 - Data modification/deletion
 - Defimation of services

Causes of these risks include:

 - Exposure of database due to lack of separation, encryption, and access control
 - Injection to database causing unauthorized changes to database (SQL injection)
 - Unaccessability of data due to unauthorized encryption (ransomware)
 - Defimation of client side through server side (EX: XSS attack on application)