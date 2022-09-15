/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Command, Commands } from "./config.js";
import { Logger } from "./logger.js";
import { executeCommandAndCaptureOutput, getPlatform, isValidPlatform } from "./utils.js";


export class CommandList {
  #commands: Commands;

  constructor(commands: Commands) {
    this.#commands = commands;
  }

  async preflightCheck(logger: Logger, commandsName: string): Promise<boolean> {
    if (this.#commands == null) {
      return true;
    }

    for (const item of this.#commands) {
      if ((typeof item) === "string") {
        continue;
      }
      const command = <Command> item;
      if (command.platform != null) {
        let platforms = command.platform;
        if ( ! Array.isArray(platforms)) {
          platforms = [platforms];
        }
        command.platform = platforms.map(p => p.toLowerCase());
        for (const platform of platforms) {
          if ( ! isValidPlatform(platform)) {
            logger.checkError(`Invalid 'platform' value '${command.platform}' in section '${commandsName}'.`);
            return false;
          }
        }
        if (command.command == null) {
          logger.checkError(`Invalid or missing 'command' field value in '${command.platform}' in section '${commandsName}'.`);
          return false;
        }
      }
    }

    logger.checkListOK(commandsName, this.#filteredCommands());
    return true;
  }

  #filteredCommands(): string[] {
    const platform = getPlatform();
    const commands: string[] = [];
    for (const item of this.#commands) {
      if ((typeof item) === "string") {
        commands.push(<string>item);
      } else {
        const command = <Command>item;
        if (command.platform === platform) {
          commands.push(command.command);
        }
      }
    }
    return commands;
  }

  async execute(logger: Logger, variables: {[key: string]: string}): Promise<boolean> {
    if (this.#commands == null) {
      return true;
    }

    for (const commandLine of this.#filteredCommands()) {
      logger.info(`Running '${commandLine}'`);
      const {result, output} = await executeCommandAndCaptureOutput(commandLine, variables);
      logger.logText(output);
      if (result !== 0) {
        logger.error(`Error occurred while running '${commandLine}'.`);
        return false;
      }
    }
    return true;
  }
}
