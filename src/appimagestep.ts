/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from "fs";
import * as path from "path";
const copy = require('recursive-copy');
import * as shell from "shelljs";
import { AddLauncherStep } from './addlauncherstep.js';

import { BuildStep } from "./buildstep.js";
import { CommandList } from './commandlist.js';
import { AppImageConfig, DebianConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { PruneStep } from './prunestep.js';
import { checkWhichCommand, getPlatform } from "./utils.js";


export class AppImageStep {
  #config: AppImageConfig;
  #commandList: CommandList;
  #appImageSourceDirectory = "";

  constructor(config: AppImageConfig) {
    this.#config = config;
    this.#commandList = new CommandList(config.prePack);
  }

  #isSkip(): boolean {
    return this.#config.skip || getPlatform() !== "linux";
  }

  async preflightCheck(logger: Logger, addLauncherStep: AddLauncherStep): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("AppImage step (skipping)");
      return true;
    }
    logger.subsection("AppImage step");

    if (! await checkWhichCommand("pkg2appimage.AppImage", logger)) {
      return false;
    }

    if (addLauncherStep == null && (this.#config.exeEntryPoint == null || this.#config.exeEntryPoint === "")) {
      logger.checkError(`Unable to determine the name of entry point executable. Add Launcher step is unavailable and nothing is specified in the config 'exeEntryPoint' field.`);
      return false;
    }

    if ( ! await this.#commandList.preflightCheck(logger, "prePack")) {
      return false
    }

    return true;
  }

  async execute(logger: Logger, prepareStep: PrepareStep, fetchStep: FetchStep, buildStep: BuildStep,
      pruneStep: PruneStep, addLauncherStep: AddLauncherStep): Promise<boolean> {

    if (this.#isSkip()) {
      logger.subsection("AppImage step (skipping)");
      return true;
    }
    logger.subsection("AppImage step");

    const APPIMAGE_SOURCE_NAME = "appimage_source";
    const appImageSourcePath = path.join(prepareStep.getTempDirectory(),
      APPIMAGE_SOURCE_NAME);

    logger.info("Copying source to AppImage directory.");

    try {
      await copy(fetchStep.getSourcePath(), path.join(appImageSourcePath, "opt/" + buildStep.getApplicationName()), {
        dot: true,
	      junk: true,
      });
    } catch (error) {
      logger.error('Copy failed: ' + error);
      return false;
    }

    this.#appImageSourceDirectory = path.join(prepareStep.getTempDirectory(), APPIMAGE_SOURCE_NAME);

    const env: { [key: string]: string } = {};
    prepareStep.addVariables(env);
    fetchStep.addVariables(env);
    buildStep.addVariables(env);
    pruneStep.addVariables(env);
    this.addVariables(env);
    if ( ! await this.#commandList.execute(logger, env)) {
      return false;
    }

    if (this.#getEntryPointExecutableName(addLauncherStep) == null) {
      logger.error(`Unable to determine the executable entry point.`);
      return false;
    }

    shell.cd(this.#appImageSourceDirectory);

    const allDesktopFiles = Array.from(shell.ls("*.desktop"));
    if (allDesktopFiles.length === 0) {
      logger.error(`No .desktop file is present in the AppImage directory. AppImage requires a .desktop file.`);
      return false;
    }

    fs.writeFileSync("appimage.yml", this.#getRecipeFile(buildStep, addLauncherStep), {encoding: "utf-8"});

    const command = `ARCH=x86_64 pkg2appimage.AppImage appimage.yml`;
    const result = shell.exec(command);
    if (result.code !== 0) {
      logger.error(`Something went wrong while running command '${command}'`);
      return false;
    }

    shell.mv(path.join(this.#appImageSourceDirectory, "out", "*.AppImage"), prepareStep.getTempDirectory());
    shell.cd(path.join(prepareStep.getTempDirectory()));
    for (const item of shell.ls("*.AppImage")) {
      logger.info(`Created AppImage: ${item}`);
    }

    return true;
  }

  #getRecipeFile(buildStep: BuildStep, addLauncherStep: AddLauncherStep): string {
    const version = buildStep.getApplicationVersion();
    const exeEntryPoint = this.#getEntryPointExecutableName(addLauncherStep);

    return `app: ${buildStep.getApplicationName()}

ingredients:
  scripts:
    - echo "${version}"

script:
  - echo "${version}" > ../VERSION
  - mv ../../opt .
  - mv ../../*.desktop . || true
  - mv ../../*.png . || true
  - cd usr/bin
  - ln -s ../../opt/${buildStep.getApplicationName()}/${exeEntryPoint}
  - cd ../..
`;
  }

  #getEntryPointExecutableName(addLauncherStep: AddLauncherStep): string {
    if (this.#config.exeEntryPoint != null && this.#config.exeEntryPoint !== "") {
      return this.#config.exeEntryPoint;
    }
    return addLauncherStep.getLauncherName();
  }

  getAppImageSourceDirectory(): string {
    return this.#appImageSourceDirectory;
  }

  addVariables(variables: {[key: string]: string}): void {
    variables["appImageStep_appImageSourceDirectory"] = this.getAppImageSourceDirectory();
  }
}
