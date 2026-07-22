#!/usr/bin/env node
import "dotenv/config";

import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import {
  authenticateGarmin,
  defaultGarminTokenFile,
  GarminSource,
  getMostRecentRun,
  saveGarminTokens,
  toBulkText,
  toMarkdown,
} from "./index.ts";

import { SourceRegistry } from "./source-registry.ts";

const registry = new SourceRegistry().register(new GarminSource());
const program = new Command()
  .name("run-stats")
  .description("Retrieve compact run stats from a configured activity source")
  .version("0.2.0")
  .option("--source <source>", "activity source", "garmin")
  .action(() => program.outputHelp());

program
  .command("login")
  .description("Log in to Garmin Connect and save a refreshable session")
  .option("--email <email>", "Garmin account email")
  .action(async (options: { email?: string }) => {
    const tokenFile = process.env.GARMIN_TOKEN_FILE ?? defaultGarminTokenFile();
    const email = (options.email ?? (await prompt("Garmin email: "))).trim();
    if (!email) throw new Error("Email is required");
    const password = await promptSecret("Garmin password: ");
    if (!password) throw new Error("Password is required");
    const tokens = await authenticateGarmin(email, password, async (method) =>
      prompt(`Garmin MFA code (${method}): `),
    );
    await saveGarminTokens(tokens, tokenFile);
    console.log(`Logged in. Session saved to ${tokenFile}`);
  });

program
  .command("recent")
  .description("List recent runs and their activity IDs")
  .option("--limit <number>", "number of runs", parsePositiveInteger, 10)
  .action(async (options: { limit: number }) => {
    const source = selectedSource();
    for (const run of await source.recentRuns(options.limit)) {
      console.log(
        [
          run.id,
          run.start?.slice(0, 10) ?? "",
          run.name,
          `${run.distanceKm ?? 0} km`,
        ].join("  "),
      );
    }
  });

program
  .command("bulk")
  .description("Print compact AI-friendly summaries for recent runs")
  .argument("[count]", "number of runs", parsePositiveInteger, 50)
  .action(async (count: number) => {
    const source = selectedSource();
    if (!(source instanceof GarminSource)) {
      throw new Error(`Source '${source.id}' does not support bulk summaries`);
    }
    process.stdout.write(toBulkText(await source.runSummaries(count)));
  });

program
  .command("show")
  .description("Retrieve and format one run")
  .argument("<activity-id>", "source activity ID")
  .option("--format <format>", "markdown or json", "markdown")
  .action(async (activityId: string, options: { format: string }) => {
    validateFormat(options.format);
    writeReport(await selectedSource().getRun(activityId), options.format);
  });

program
  .command("latest")
  .description("Retrieve and format the most recent run")
  .option("--format <format>", "markdown or json", "markdown")
  .action(async (options: { format: string }) => {
    validateFormat(options.format);
    writeReport(await getMostRecentRun(selectedSource()), options.format);
  });

program.parseAsync().catch((error: unknown) => {
  console.error(
    `error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});

function selectedSource() {
  return registry.get(program.opts<{ source: string }>().source);
}

function parsePositiveInteger(value: string): number {
  const result = Number.parseInt(value, 10);
  if (!Number.isInteger(result) || result <= 0)
    throw new Error("Limit must be a positive integer");
  return result;
}

function validateFormat(format: string): void {
  if (!new Set(["markdown", "json"]).has(format)) {
    throw new Error("Format must be 'markdown' or 'json'");
  }
}

function writeReport(
  report: Awaited<ReturnType<typeof getMostRecentRun>>,
  format: string,
): void {
  process.stdout.write(
    format === "json"
      ? `${JSON.stringify(report, null, 2)}\n`
      : toMarkdown(report),
  );
}

async function prompt(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Login prompts require an interactive terminal");
  }
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await terminal.question(label);
  } finally {
    terminal.close();
  }
}

async function promptSecret(label: string): Promise<string> {
  if (
    !process.stdin.isTTY ||
    !process.stdout.isTTY ||
    !process.stdin.setRawMode
  ) {
    throw new Error("Password prompt requires an interactive terminal");
  }
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer | string) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") return finish(new Error("Login cancelled"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b")
          value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}
