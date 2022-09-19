#!/usr/bin/env node
/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Command } from 'commander';
import { Logger } from './logger.js';
import { createPlan, Plan } from './plan.js';


enum Action {
  check,
  package
}

async function main(): Promise<void> {
  const program = new Command();

  program.name('ship-nodegui');
  program.description('Tool to package NodeGui applications');
  program.version('0.1.0');
  program.option('-c, --config <config>', 'Path to config file');
  program.action(() => {
    execute(program, Action.package);
  });
  program.command('check').action(async () => {
    await execute(program, Action.check);
  });
  await program.parseAsync();
}

async function execute(program: Command, action: Action): Promise<void> {
  const options = program.opts();
  const configPath = options.config ?? "test-config.json";

  const logger = new Logger();
  let plan: Plan = null;
  try {
    plan = createPlan(logger, configPath);
  } catch(e) {
    logger.error(e);
  }

  switch(action) {
    case Action.check:
      await plan.preflightCheck();
      break;
    case Action.package:
      await plan.execute();
      break;
  }
}
main();

export {};
