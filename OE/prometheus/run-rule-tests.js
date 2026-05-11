const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const prometheusDir = __dirname;
const testFilePath = path.join(prometheusDir, "rules.test.yml");
const dockerImage = "prom/prometheus:v3.7.1";

function getNamedTestBlocks(fileContents) {
    const lines = fileContents.split(/\r?\n/);
    const testsIndex = lines.findIndex((line) => line.trim() === "tests:");

    if (testsIndex === -1) {
        throw new Error("Could not find a `tests:` section in rules.test.yml.");
    }

    const headerLines = lines.slice(0, testsIndex + 1);
    const testBlocks = [];
    let currentBlock = [];

    for (const line of lines.slice(testsIndex + 1)) {
        if (line.startsWith("  - name: ")) {
            if (currentBlock.length > 0) {
                testBlocks.push(currentBlock);
            }

            currentBlock = [line];
            continue;
        }

        if (currentBlock.length > 0) {
            currentBlock.push(line);
        }
    }

    if (currentBlock.length > 0) {
        testBlocks.push(currentBlock);
    }

    return {
        headerLines,
        testBlocks: testBlocks.map((block) => {
            const nameLine = block[0];
            return {
                name: nameLine.replace("  - name: ", "").trim(),
                contents: [...headerLines, ...block].join("\n")
            };
        })
    };
}

function runPromtoolForTest(tempFileName) {
    const args = [
        "run",
        "--rm",
        "--entrypoint",
        "promtool",
        "-v",
        `${prometheusDir}:/work`,
        dockerImage,
        "test",
        "rules",
        `/work/${tempFileName}`
    ];

    return spawnSync("docker", args, {
        encoding: "utf8",
        stdio: "pipe"
    });
}

function indentBlock(text) {
    return text
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .map((line) => `    ${line}`)
        .join("\n");
}

function main() {
    const fileContents = fs.readFileSync(testFilePath, "utf8");
    const { testBlocks } = getNamedTestBlocks(fileContents);

    if (testBlocks.length === 0) {
        throw new Error("No named tests were found in rules.test.yml.");
    }

    console.log(`Running ${testBlocks.length} Prometheus rule test case(s):`);
    for (const [index, testBlock] of testBlocks.entries()) {
        console.log(`  ${index + 1}. ${testBlock.name}`);
    }
    console.log("");

    let passed = 0;
    let failed = 0;

    for (const [index, testBlock] of testBlocks.entries()) {
        const tempFileName = `rules.test.${index + 1}.yml`;
        const tempFilePath = path.join(prometheusDir, tempFileName);

        fs.writeFileSync(tempFilePath, `${testBlock.contents}\n`);

        console.log(`[RUN ] ${testBlock.name}`);
        const result = runPromtoolForTest(tempFileName);

        if (result.status === 0) {
            passed += 1;
            console.log(`[PASS] ${testBlock.name}\n`);
        } else {
            failed += 1;
            console.log(`[FAIL] ${testBlock.name}`);

            const combinedOutput = [result.stdout, result.stderr]
                .filter(Boolean)
                .join("\n")
                .trim();

            if (combinedOutput) {
                console.log(indentBlock(combinedOutput));
            }

            console.log("");
        }

        fs.unlinkSync(tempFilePath);
    }

    console.log(`Summary: ${passed} passed, ${failed} failed, ${testBlocks.length} total.`);

    if (failed > 0) {
        process.exit(1);
    }
}

main();
