/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "path";
import * as shell from "shelljs";
import { CommandList } from './commandlist.js';
import { FetchConfig } from "./config.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { executeCommandAndCaptureOutput } from "./utils.js";


interface GitPosition {
  url: string;
  branch?: string;
  hash?:string;
}


export class FetchStep {
  #config: FetchConfig;
  #gitSourceDirectoryName: string = "git_source";
  #gitSourcePath: string = null;
  #gitUrl: string = null;
  #gitBranch: string = null;
  #gitHash: string = null;
  #tempDirectory: string = null;
  #commandList: CommandList;

  constructor(config: FetchConfig) {
    this.#config = config;
    this.#commandList = new CommandList(config.postFetch);
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    logger.subsection("Fetch step");
    const gitUrl = this.#config.gitUrl;
    if (gitUrl != null) {
      const {result, output } = await executeCommandAndCaptureOutput('git --version');
      if (result === 0) {
        logger.checkOk(`Found 'git' command version: ${output.trim()}`);
      } else {
        logger.checkError(`Unable to run 'git --version'. Command reported: ${output}`);
        return false;
      }

      const branch = this.#config.gitBranch == null ? null : this.#config.gitBranch;
      logger.checkOk(`Will fetch project from git repository at '${gitUrl}' using branch '${branch == null ? '<default>' : branch}'`);
    } else {
      if (this.#config.gitFromCwd) {
        logger.checkOk(`Will fetch GIT URL and branch from the current directory.`);
      } else {
        logger.checkError(`Either 'gitUrl' or 'gitFromCwd' need to be set in the configuration.`);
        return false;
      }
    }

    if ( ! await this.#commandList.preflightCheck(logger, "postFetch")) {
      return false
    }

    return true;
  }

  async describe(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async execute(logger: Logger, prepareStep: PrepareStep): Promise<boolean> {
    logger.subsection("Fetch step");

    if (this.#config.gitUrl != null) {
      this.#gitUrl = this.#config.gitUrl;
      this.#gitBranch = this.#config.gitBranch != null ? this.#config.gitBranch : null;
      this.#gitHash = null;
    } else {
      const gitPosition = await this.#readCwdGitConfig(logger);
      if (gitPosition == null) {
        return false;
      }
      const { url, branch, hash } = gitPosition;
      this.#gitUrl = url;
      this.#gitBranch = branch;
      this.#gitHash = hash;
    }

    logger.info(`Using git url: '${this.#gitUrl}'`);
    if (this.#gitBranch != null) {
      logger.info(`Using git branch: '${this.#gitBranch}'`);
    }
    if (this.#gitHash != null) {
      logger.info(`Using git hash: '${this.#gitHash}'`);
    }

    this.#tempDirectory = prepareStep.getTempDirectory();
    this.#gitSourcePath = path.join(this.#tempDirectory, this.#gitSourceDirectoryName);

    shell.cd(prepareStep.getTempDirectory());

    if (this.#gitHash != null) {
      const command = `git clone ${this.#gitUrl} ${this.#gitSourceDirectoryName}`;
      logger.info(`Cloning complete Git repository with command '${command}'`)
      const result = shell.exec(command);
      if (result.code !== 0) {
        logger.error(`Something went wrong while running command '${command}'`);
        return false;
      }
      shell.cd(this.#gitSourceDirectoryName);

      const checkoutCommand = `git checkout ${this.#gitHash}`;
      const checkoutResult = shell.exec(checkoutCommand);
      if (checkoutResult.code !== 0) {
        logger.error(`Something went wrong while running command '${checkoutCommand}'`);
        return false;
      }

    } else {
      const branchOption = this.#gitBranch != null ? `-b ${this.#gitBranch}` : "";
      const command = `git clone --depth 1 ${branchOption} ${this.#gitUrl} ${this.#gitSourceDirectoryName}`;
      logger.info(`Shallow cloning Git repository with command '${command}'`)

      const result = shell.exec(command);
      if (result.code !== 0) {
        logger.error(`Something went wrong while running command '${command}'`);
        return false;
      }
    }

    const env: { [key: string]: string } = {};
    prepareStep.addVariables(env);
    this.addVariables(env);
    if ( ! await this.#commandList.execute(logger, env)) {
      return false;
    }

    return true;
  }

  async #readCwdGitConfig(logger: Logger): Promise<GitPosition> {
    const urlCommand = "git config --get remote.origin.url";
    const {result: urlReturnCode, output: url } = await executeCommandAndCaptureOutput(urlCommand);
    if (urlReturnCode !== 0) {
      logger.error(`An error occurred while running command '${urlCommand}': ${url}`);
      return null;
    }

    const branchCommand = "git branch --show-current";
    const {result: branchReturnCode, output: branchOutput } = await executeCommandAndCaptureOutput(branchCommand);
    if (branchReturnCode !== 0) {
      logger.error(`An error occurred while running command '${urlCommand}': ${branchOutput}`);
      return null;
    }
    let branch = branchOutput.trim();
    let hash: string = null;
    if (branch === "") {
      branch = null;
      const headCommand = "git rev-parse --short HEAD";
      const {result: headReturnCode, output: headOutput } = await executeCommandAndCaptureOutput(headCommand);
      if (headReturnCode !== 0) {
        logger.error(`An error occurred while running command '${headCommand}': ${branchOutput}`);
        return null;
      }
      hash = headOutput.trim();
    }
    return { url: url.trim(), branch, hash };
  }

  getSourcePath(): string {
    return this.#gitSourcePath;
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
    this.#gitSourcePath = newSourcePath;
  }
}
