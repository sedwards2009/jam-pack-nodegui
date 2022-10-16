/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from "fs";
import * as path from "path";
import * as shell from "shelljs";

import { BuildConfig } from "./config.js";
import { CommandList } from './commandlist.js';
import { FetchStep } from "./fetchstep.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { executeCommandAndCaptureOutput } from "./utils.js";


export class BuildStep {
  #config: BuildConfig = null;
  #commandList: CommandList;

  #packageApplicationName: string = null;
  #packageApplicationVersion: string = null;

  constructor(config: BuildConfig) {
    this.#config = config;
    this.#commandList = new CommandList(config.postBuild);
  }

  #isSkip(): boolean {
    return this.#config.skip;
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("Build step (skipping)");
      return true;
    }

    logger.subsection("Build step");
    const manager = this.#getPackageManager();
    if (manager !== "npm" && manager !== "yarn") {
      logger.checkError(`Unsupported Node package manager '${manager}' was specified`);
      return false;
    }
    logger.checkOk(`Using Node package manager '${manager}'`);

    const {result, output } = await executeCommandAndCaptureOutput(`${manager} --version`);
    if (result === 0) {
      logger.checkOk(`Found '${manager}' command version: ${output.trim()}`);
    } else {
      logger.checkError(`Unable to run '${manager} --version'. Command reported: ${output}`);
      return false;
    }
    logger.checkOk(`Using package script '${this.#getBuildScriptName()}' to build`);

    if (this.#config.applicationName != null) {
      logger.checkOk(`Using '${this.#config.applicationName}' as the application name.`);
    } else {
      logger.checkOk(`Will get the application name from package.json.`);
    }

    if (this.#config.applicationVersion != null) {
      logger.checkOk(`Using '${this.#config.applicationVersion}' as the application version.`);
    } else {
      logger.checkOk(`Will get the application version from package.json.`);
    }

    if ( ! await this.#commandList.preflightCheck(logger, "postBuild")) {
      return false
    }

    return true;
  }

  #getPackageManager(): string {
    if (this.#config.packageManager != null) {
      return this.#config.packageManager;
    }
    return "npm";
  }

  #getBuildScriptName(): string {
    if (this.#config.scriptName == null) {
      return "build";
    }
    return this.#config.scriptName;
  }

  async describe(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async execute(logger: Logger, prepareStep: PrepareStep, fetchStep: FetchStep): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("Build step (skipping)");
      return true;
    }
    logger.subsection("Build step");

    shell.cd(fetchStep.getSourcePath());

    if ( ! this.#readPackageVariables(logger, fetchStep)) {
      return false;
    }
    logger.info(`Using application name '${this.getApplicationName()}' version '${this.getApplicationVersion()}'`);

    const installCommand = `${this.#getPackageManager()} install`;
    logger.info(`Installing packages with command '${installCommand}'`);
    const installResult = shell.exec(installCommand);
    if (installResult.code !== 0) {
      logger.error(`Something went wrong while running command '${installCommand}'`);
      return false;
    }

    const buildCommand = `${this.#getPackageManager()} run ${this.#getBuildScriptName()}`;
    logger.info(`Building source with command '${buildCommand}'`);
    const buildResult = shell.exec(buildCommand);
    if (buildResult.code !== 0) {
      logger.error(`Something went wrong while running command '${buildCommand}'`);
      return false;
    }

    shell.cd(prepareStep.getTempDirectory());
    const env: { [key: string]: string } = {};
    prepareStep.addVariables(env);
    fetchStep.addVariables(env);
    this.addVariables(env);
    if ( ! await this.#commandList.execute(logger, env)) {
      return false;
    }

    return true;
  }

  getApplicationName(): string {
    if (this.#config.applicationName != null) {
      return this.#config.applicationName;
    }
    return this.#packageApplicationName;
  }

  getApplicationVersion(): string {
    if (this.#config.applicationVersion != null) {
      return this.#config.applicationVersion;
    }
    return this.#packageApplicationVersion;
  }

  addVariables(variables: {[key: string]: string}): void {
    variables["buildStep_applicationName"] = this.getApplicationName();
    variables["buildStep_applicationVersion"] = this.getApplicationVersion();
  }

  #readPackageVariables(logger: Logger, fetchStep: FetchStep): boolean {
    const packagePath = path.posix.join(fetchStep.getSourcePath(), "package.json");

    if ( ! fs.existsSync(packagePath)) {
      logger.error(`Could not find 'package.json' inside ${fetchStep.getSourcePath()}`);
      return false;
    }

    const packageJsonString = fs.readFileSync(packagePath, {encoding: "utf8"});
    let packageJson: any = null;
    try {
      packageJson = JSON.parse(packageJsonString);
    } catch (e) {
      logger.error(`Unable to parse JSON from '${packagePath}'`);
    }

    this.#packageApplicationName = packageJson.name;
    this.#packageApplicationVersion = packageJson.version;
    return true;
  }
}
