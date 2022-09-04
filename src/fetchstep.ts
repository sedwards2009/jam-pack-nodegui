/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import path from "node:path";
import shell from "shelljs";
import { FetchConfig } from "./config.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { executeCommandAndCaptureOutput } from "./utils.js";


export class FetchStep {
  #config: FetchConfig;
  #gitSourceDirectoryName: string = "git_source";
  #gitSourceDirectory: string = null;
  #tempDirectory: string = null;

  constructor(config: FetchConfig) {
    this.#config = config;
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    logger.subsection("Fetch step");
    const gitUrl = this.#config.gitUrl;
    if (gitUrl != null) {
      logger.checkOk(`Will fetch project from git repository at '${gitUrl}'`);

      const {result, output } = await executeCommandAndCaptureOutput('git --version');
      if (result === 0) {
        logger.checkOk(`Found 'git' command version: ${output.trim()}`);
      } else {
        logger.checkError(`Unable to run 'git --version'. Command reported: ${output}`);
        return false;
      }

    } else {
      logger.checkOk(`Will fetch project using commands`);
    }

    return true;
  }

  async describe(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async execute(logger: Logger, prepareStep: PrepareStep): Promise<boolean> {
    logger.subsection("Fetch step");

    this.#tempDirectory = prepareStep.getTempDirectory();
    this.#gitSourceDirectory = path.join(this.#tempDirectory, this.#gitSourceDirectoryName);

    shell.cd(prepareStep.getTempDirectory());
    const command = `git clone --depth 1 ${this.#config.gitUrl} ${this.#gitSourceDirectoryName}`;
    logger.info(`Cloning repository with command '${command}'`)

    const result = shell.exec(command);
    if (result.code !== 0) {
      logger.error(`Something went wrong while running command '${command}'`);
      return false;
    }

    return true;
  }

  getSourcePath(): string {
    return this.#gitSourceDirectory;
  }

  getSourceDirectoryName(): string {
    return this.#gitSourceDirectoryName;
  }

  addVariables(variables: {[key: string]: string}): void {
    variables["fetchStep_sourcePath"] = this.getSourcePath();
    variables["fetchStep_sourceDirectoryName"] = this.getSourceDirectoryName();
  }

  moveSourceDirectory(name: string): void {
    if (name === this.#gitSourceDirectoryName) {
      return;
    }

    const currentSourcePath = this.getSourcePath();
    const newSourcePath = path.join(this.#tempDirectory, name);

    shell.mv(currentSourcePath, newSourcePath);

    this.#gitSourceDirectoryName = name;
    this.#gitSourceDirectory = newSourcePath;
  }
}
