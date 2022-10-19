#!/usr/bin/env node
/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Command } from "commander";
import { Logger } from "./logger.js";
import { createPlan, Plan } from "./plan.js";


enum Action {
  check,
  package
}

async function main(): Promise<void> {
  const program = new Command();

  const collectSetting = (value: string, previous: string[]): string[] => {
    previous.push(value);
    return previous;
  };

  program.name("ship-nodegui");
  program.description("Tool to package NodeGui applications");
  program.version("0.1.0");
  program.option("-c, --config <config>", "Path to config file");
  program.option("-D, --define <setting>", "Define a setting. (Overrides the config file)", collectSetting, []);
  program.action(async () => {
    process.exit(await execute(program, Action.package) ? 0 : 1);
  });
  program.command("check").action(async () => {
    process.exit(await execute(program, Action.check) ? 0 : 1);
  });
  await program.parseAsync();
}

async function execute(program: Command, action: Action): Promise<boolean> {
  const options = program.opts();
  const configPath = options.config ?? "test-config.json";

  const logger = new Logger();
  let plan: Plan = null;
  try {
    plan = createPlan(logger, configPath, options.define);
  } catch(e) {
    logger.error(e);
  }

  switch(action) {
    case Action.check:
      return await plan.preflightCheck();
    case Action.package:
      return await plan.execute();
  }
}
main();

export {};
