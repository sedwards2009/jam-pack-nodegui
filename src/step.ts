/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger } from "./logger.js";

export interface Step {
  preflightCheck(logger: Logger): Promise<boolean>;
  describe(): Promise<string>;
  execute(logger: Logger): Promise<boolean>;
}
