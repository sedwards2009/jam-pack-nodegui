/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import fs from 'node:fs';
import shell from "shelljs";
import { BuildStep } from './buildstep.js';
import { Config } from './config.js';
import { FetchStep } from './fetchstep.js';
import { Logger } from './logger.js';
import { PrepareStep } from './preparestep.js';
import { PruneStep } from './prunestep.js';
import { ZipStep } from './zipstep.js';


export function createPlan(logger: Logger, configPath: string): Plan {
  if ( ! fs.existsSync(configPath)) {
    logger.error(`Config file not found at '${configPath}'.`);
    throw new Error(`Config file not found at '${configPath}'.`);
  }

  const configFile = fs.readFileSync(configPath, {encoding: 'utf8'});

  let config: Config = null;
  try {
    config = parseConfig(configFile);
  } catch(e) {
    throw new Error(`An error occurred while parsing JSON config at '${configPath}'. ${e}`);
  }
  return new Plan(configPath, <Config> config);
}

function parseConfig(configFile: string): Config {
  let config: Config = null;
  config = JSON.parse(configFile);

  if (config.fetch === undefined) {
    throw new Error(`Config file doesn't have a 'fetch' section.`);
  }
  if (config.build === undefined) {
    throw new Error(`Config file doesn't have a 'build' section.`);
  }
  if (config.prune === undefined) {
    throw new Error(`Config file doesn't have a 'prune' section.`);
  }
  return config;
}

export class Plan {
  #config: Config = null;
  #configPath = "";
  #logger: Logger = null;

  #prepareStep: PrepareStep = null;
  #fetchStep: FetchStep = null;
  #buildStep: BuildStep = null;
  #pruneStep: PruneStep = null;
  #zipStep: ZipStep = null;

  constructor(configPath: string, config: Config) {
    this.#config = config;
    this.#configPath = configPath;

    this.#logger = new Logger();

    this.#prepareStep = new PrepareStep(config.prepare);
    this.#fetchStep = new FetchStep(config.fetch);
    this.#buildStep = new BuildStep(config.build);
    this.#pruneStep = new PruneStep(config.prune);

    if (config.zip != null) {
      this.#zipStep = new ZipStep(config.zip);
    }
  }

  async preflightCheck(): Promise<boolean> {
    this.#logger.section(`Preflight Check`);
    this.#logger.checkOk(`Using config file '${this.#configPath}'`);

    if ( ! await this.#prepareStep.preflightCheck(this.#logger)) {
      return false;
    }
    if ( ! await this.#fetchStep.preflightCheck(this.#logger)) {
      return false;
    }
    if ( ! await this.#buildStep.preflightCheck(this.#logger)) {
      return false;
    }
    if ( ! await this.#pruneStep.preflightCheck(this.#logger)) {
      return false;
    }
    if (this.#zipStep != null && (!await this.#zipStep.preflightCheck(this.#logger))) {
      return false;
    }
    return true;
  }

  async execute(): Promise<boolean> {
    const cwd = shell.pwd();
    if ( ! await this.preflightCheck()) {
      return false;
    }
    shell.cd(cwd);

    this.#logger.section(`Packaging`);

    if ( ! await this.#prepareStep.execute(this.#logger)) {
      this.#logger.error("Prepare step failed.");
      return false;
    }
    shell.cd(cwd);

    if ( ! await this.#fetchStep.execute(this.#logger, this.#prepareStep)) {
      this.#logger.error("Fetch step failed.");
      return false;
    }
    shell.cd(cwd);

    if( ! await this.#buildStep.execute(this.#logger, this.#fetchStep)) {
      this.#logger.error("Build step failed.");
      return false;
    }
    shell.cd(cwd);

    if ( ! await this.#pruneStep.execute(this.#logger, this.#fetchStep)) {
      this.#logger.error("Prune step failed.");
      return false;
    }
    shell.cd(cwd);

    if (this.#zipStep != null && ( ! await this.#zipStep.execute(this.#logger, this.#prepareStep, this.#fetchStep,
        this.#buildStep))) {
      return false;
    }
    shell.cd(cwd);

    return true;
  }
}
