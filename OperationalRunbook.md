# Runbook

In this operational runbook, you will understand how to investigate a given failed test case, what to do to fix such failure, and to get the application back into running condition.

## Investigation

Initially, use the following npm command to understand which test cases are failing:

```javascript
npm run security_test
```

Use the results of the script to determine which area of the application has issues and whether it matches the issue you are investigating.

Go to kuma dashboard to understand if the issue resides with server connectivity and resources.

## Mitigation

If there is an issue regarding connection to logging or record databases, restart corresponding database containters

If there is an issue regarding connection to backend API logic, restart corresponding containters

If there is an issue regarding user login, restart the project containter and ask user to try again

If there is an issue regarding unauthorized access, end the unauthorized session and contact victim user's recovery for password and MFA renewal

## Recovery

To best return the project to working condition after fixes, run the following docker and npm commands:

```powershell
docker compose down -v
npm run seed
docker compose build
docker compose up -d
```

Be sure to address any build issues as they show in order to prevent future failing.