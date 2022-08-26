/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { execute } from "@yarnpkg/shell";
import {PassThrough} from 'stream';


export class WritableBuffer extends PassThrough {
  #chunks: Buffer[] = [];

  constructor() {
    super();
    this.on(`data`, chunk => {
      this.#chunks.push(chunk);
    });
  }

  getText(): string {
    return Buffer.concat(this.#chunks).toString('utf8');
  }
}

export async function executeCommandAndCaptureOutput(command: string): Promise<{result: number, output: string }> {
  const outputBuffer = new WritableBuffer();
  const result = await execute(command, [], {
    stdin: null,
    stdout: outputBuffer,
    stderr: outputBuffer
  });

  const output = outputBuffer.getText();
  return {result, output};
}