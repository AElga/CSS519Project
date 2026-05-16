This is based on the questions identified in the OEQuestion.md document:

```
- What is the average and p95/p99 response time for key endpoints?
- Are any APIs failing or degraded?
- What is the CPU/RAM usage of the servers? Databases?
- What is the database connection status?
- What is the average TCP/UDP session latency?
- What are peak/low usage times?
```

With the updates made to the OE dashboards, most of these question are answerable, with the only question not directly answered is TCP/UDP latency.

The OE Dashboards are now more equipped to answer performance/availability risks, which were defined as below (from DisruptionRisk.md):

- Abnormal Latency
- API Unavailability
- Unsyncronized data

When it comes to confidentiality/integrity risks, data modification/deletion is considered to an extent (under grafana database operations, storage growth, and logs). However, there is not a way to see how the data was modified (what the query was), just how much data exsis and the type of data (users, appointments, logs) is being operated on. In addition, there is no way for the OE dashboards to assess if any UI element changes were unauthorized (pointing to vandilism).