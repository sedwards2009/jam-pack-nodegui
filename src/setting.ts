/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Config } from './config.js';

const configRootKey: (keyof Config)[] = [
  "prepare",
  "fetch",
  "build",
  "prune",
  "quietQode",
  "addLauncher",
  "zip",
  "debian",
  "nsis",
  "appImage",
  "dmg",
];


export class Setting {

  #settingString: string = null;

  constructor(settingString: string) {
    this.#settingString = settingString;
  }

  getError(): string {
    const { key, keyParts, value } = this.#splitKeyValue(this.#settingString);
    if ( ! (<string[]> configRootKey).includes(keyParts[0])) {
      return `Unknown config key part '${keyParts[0]}' found in key '${key}'.`;
    }

    return null;
  }

  #splitKeyValue(keyValue: string): { key: string; keyParts: string[]; value: string; } {
    let key = "";
    let value = "";
    const index = keyValue.indexOf("=");
    if (index !== -1) {
      key = keyValue.substring(0, index);
      value = keyValue.substring(index+1);
    } else {
      key = keyValue;
    }

    const keyParts = key.split(".");
    return { key, keyParts, value };
  }

  apply(config: Config): void {
    const { key, keyParts, value } = this.#splitKeyValue(this.#settingString);
    config[keyParts[0]][keyParts[1]] = value;
  }
}
