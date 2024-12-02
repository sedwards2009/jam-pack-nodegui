/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as shell from "shelljs";
import { AddLauncherStep } from './addlauncherstep.js';
import { AppImageStep } from './appimagestep.js';
import { BuildStep } from './buildstep.js';
import { Config } from './config.js';
import { DebianStep } from './debianstep.js';
import { FetchStep } from './fetchstep.js';
import { Logger } from './logger.js';
import { NSISStep } from './nsisstep.js';
import { PrepareStep } from './preparestep.js';
import { PruneStep } from './prunestep.js';
import { QuietQodeStep } from './quietqodestep.js';
import { getPlatform } from './utils.js';
import { ZipStep } from './zipstep.js';
import { DmgStep } from './dmgstep.js';
import { Setting } from './setting.js';


export function createPlan(logger: Logger, configPath: string, settingsString: string[]): Plan {
  if ( ! fs.existsSync(configPath)) {
    logger.error(`Configuration file not found at '${configPath}'.`);
    throw new Error(`Configuration file not found at '${configPath}'.`);
  }

  const settings = settingsString.map(s => new Setting(s));
  for (const setting of settings) {
    const error = setting.getError();
    if (error != null) {
      throw new Error(error);
    }
  }

  const configFile = fs.readFileSync(configPath, {encoding: "utf8"});

  let config: Config = null;
  try {
    config = parseConfig(configFile);
  } catch(e) {
    throw new Error(`An error occurred while parsing JSON configuration at '${configPath}'. ${e}`);
  }

  for (const setting of settings) {
    setting.apply(config);
  }

  return new Plan(configPath, <Config> config);
}

function parseConfig(configFile: string): Config {
  let config: Config = null;
  config = JSON.parse(configFile);

  if (config.fetch === undefined) {
    throw new Error(`Configuration file doesn't have a 'fetch' section.`);
  }
  if (config.build === undefined) {
    throw new Error(`Configuration file doesn't have a 'build' section.`);
  }
  if (config.prune === undefined) {
    throw new Error(`Configuration file doesn't have a 'prune' section.`);
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
  #quietQodeStep: QuietQodeStep = null;
  #addLauncherStep: AddLauncherStep = null;
  #zipStep: ZipStep = null;
  #debianStep: DebianStep = null;
  #appImageStep: AppImageStep = null;
  #nsisStep: NSISStep = null;
  #dmgStep: DmgStep = null;

  constructor(configPath: string, config: Config) {
    this.#config = config;
    this.#configPath = configPath;

    this.#logger = new Logger();

    this.#prepareStep = new PrepareStep(config.prepare);
    this.#fetchStep = new FetchStep(config.fetch);
    this.#buildStep = new BuildStep(config.build);
    this.#pruneStep = new PruneStep(config.prune);

    if (config.addLauncher != null) {
      this.#addLauncherStep = new AddLauncherStep(config.addLauncher);
    }

    if (config.zip != null) {
      this.#zipStep = new ZipStep(config.zip);
    }

    if (getPlatform() === "linux" && config.debian != null) {
      this.#debianStep = new DebianStep(config.debian);
    }
    if (getPlatform() === "linux" && config.appImage != null) {
      this.#appImageStep = new AppImageStep(config.appImage);
    }

    if (getPlatform() === "windows" && config.nsis != null) {
      this.#nsisStep = new NSISStep(config.nsis);
    }

    if (getPlatform() === "windows" && config.quietQode != null) {
      this.#quietQodeStep = new QuietQodeStep(config.quietQode);
    }

    if (getPlatform() === "macos" && config.dmg != null) {
      this.#dmgStep = new DmgStep(config.dmg);
    }
  }

  async preflightCheck(): Promise<boolean> {
    this.#logger.section(`Preflight Check`);
    this.#logger.checkOk(`Using configuration file '${this.#configPath}'`);

    if ( ! await this.#prepareStep.preflightCheck(this.#logger)) {
      return false;
    }
    if ( ! await this.#fetchStep.preflightCheck(this.#logger)) {
      return false;
    }
    if ( ! await this.#buildStep.preflightCheck(this.#logger)) {
      return false;
    }
    if ( ! await this.#pruneStep.preflightCheck(this.#logger, this.#prepareStep)) {
      return false;
    }
    if (this.#quietQodeStep != null && ( ! await this.#quietQodeStep.preflightCheck(this.#logger))) {
      return false;
    }
    if (this.#addLauncherStep != null && ( ! await this.#addLauncherStep.preflightCheck(this.#logger))) {
      return false;
    }
    if (this.#zipStep != null && ( ! await this.#zipStep.preflightCheck(this.#logger))) {
      return false;
    }
    if (this.#debianStep != null && ( ! await this.#debianStep.preflightCheck(this.#logger))) {
      return false;
    }
    if (this.#appImageStep != null && ( ! await this.#appImageStep.preflightCheck(this.#logger, this.#addLauncherStep))) {
      return false;
    }
    if (this.#nsisStep != null && ( ! await this.#nsisStep.preflightCheck(this.#logger))) {
      return false;
    }
    if (this.#dmgStep != null && ( ! await this.#dmgStep.preflightCheck(this.#logger))) {
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

    if( ! await this.#buildStep.execute(this.#logger, this.#prepareStep, this.#fetchStep)) {
      this.#logger.error("Build step failed.");
      return false;
    }
    shell.cd(cwd);

    if ( ! await this.#pruneStep.execute(this.#logger, this.#prepareStep, this.#fetchStep, this.#buildStep)) {
      this.#logger.error("Prune step failed.");
      return false;
    }
    shell.cd(cwd);

    if (this.#quietQodeStep != null && ( ! await this.#quietQodeStep.execute(this.#logger, this.#fetchStep))) {
      this.#logger.error("Quiet Qode step failed.");
      return false;
    }
    shell.cd(cwd);

    if (this.#addLauncherStep != null && ( ! await this.#addLauncherStep.execute(this.#logger, this.#fetchStep,
        this.#buildStep, this.#pruneStep))) {
      this.#logger.error("Add Launcher step failed.");
      return false;
    }
    shell.cd(cwd);

    if (this.#zipStep != null && ( ! await this.#zipStep.execute(this.#logger, this.#prepareStep, this.#fetchStep,
        this.#buildStep))) {
      this.#logger.error("Zip step failed.");
      return false;
    }
    shell.cd(cwd);

    if (this.#debianStep != null && ( ! await this.#debianStep.execute(this.#logger, this.#prepareStep, this.#fetchStep,
        this.#buildStep, this.#pruneStep))) {

      this.#logger.error("Debian step failed.");
      return false;
    }
    shell.cd(cwd);

    if (this.#appImageStep != null && ( ! await this.#appImageStep.execute(this.#logger, this.#prepareStep,
        this.#fetchStep, this.#buildStep, this.#pruneStep, this.#addLauncherStep))) {

      this.#logger.error("AppImage step failed.");
      return false;
    }
    shell.cd(cwd);

    if (this.#nsisStep != null && ( ! await this.#nsisStep.execute(this.#logger, this.#prepareStep, this.#fetchStep,
        this.#buildStep, this.#pruneStep))) {

      this.#logger.error("NSIS step failed.");
      return false;
    }
    shell.cd(cwd);

    if (this.#dmgStep != null && ( ! await this.#dmgStep.execute(this.#logger, this.#prepareStep, this.#fetchStep,
      this.#buildStep, this.#pruneStep, this.#addLauncherStep))) {

      this.#logger.error("DMG step failed.");
      return false;
    }
    shell.cd(cwd);

    return true;
  }
}
