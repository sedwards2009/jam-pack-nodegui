/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "node:path";
import shell from "shelljs";

import { PrepareConfig } from "./config.js";
import { Logger } from "./logger.js";
import { Step } from "./step.js";

export class PrepareStep implements Step {

  #config: PrepareConfig = null;
  #baseTempDirectory: string = null;

  constructor(config: PrepareConfig) {
    this.#config = config;
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    logger.subsection("Prepare step");

    let tempDir = "./tmp-jam-pack-nodegui";
    if (this.#config != null && this.#config.tempDirectory != null) {
      tempDir = this.#config.tempDirectory;
    }
    if (path.isAbsolute(tempDir)) {
      this.#baseTempDirectory = tempDir;
    } else {
      this.#baseTempDirectory = path.posix.join("" + shell.pwd(), tempDir);
    }

    logger.checkOk(`Using temporary directory '${this.getTempDirectory()}'`);
    return true;
  }

  getTempDirectory(): string {
    return path.join(this.#baseTempDirectory, "jam-pack-nodegui-work");
  }

  async describe(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async execute(logger: Logger): Promise<boolean> {
    logger.subsection("Prepare step");

    const tempDir = this.getTempDirectory();
    if (shell.test('-e', tempDir)) {
      shell.rm('-rf', tempDir);
    }

    shell.mkdir('-p', tempDir);
    logger.checkOk(`Created temporary work directory '${tempDir}'`);
    return true;
  }
}
