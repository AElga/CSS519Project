Other than more encompasing unit tests, the following are some gaps to the CI/CD pipeline that I currently have:

- Boundary Tests (edge cases): All current test cases test a certain scenario to make sure all functions/APIs are called and executed correctly, so having boundary tests can ensure to catch errors that may not be handled correctly.
- Equivalence Classes: All test cases Login success and audit, which is universal across all roles of this project. adding test cases that are unique to roles will help test role specific functions.
- End to End: End to end is still a ways away as the project is not fully complete.
- Additional Improvements: One improvement to the current ci/cd pipleine is timeouts for any un accounted for loops/issues (and for latency checking)

In addition, I have included a failing test case to simulate diversity in the testing of the project.