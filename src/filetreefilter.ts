/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as shell from "shelljs";
import { Minimatch } from "minimatch";


interface PatternSet {
  acceptMatchers: Minimatch[];
  rejectMatchers: Minimatch[];
}

export type ResultCallback = (path: string, accept: boolean) => void;


export class FileTreeFilter {

  #patternSets: PatternSet[] = [];
  #resultCallback: ResultCallback = null;

  constructor(resultCallback: ResultCallback) {
    this.#resultCallback = resultCallback;
  }

  addPattern(acceptList: string[], rejectList: string[]): void {
    this.#patternSets.push({
      acceptMatchers: acceptList.map(p => new Minimatch(p, {})),
      rejectMatchers: rejectList.map(p => new Minimatch(p, {}))
    });
  }

  run(dir: string): void {
    for (const itemPath of shell.find(dir)) {
      if (shell.test('-d', itemPath)) {
        continue;
      }
      this.#resultCallback(itemPath, this.#isAccept(itemPath));
    }
  }

  #isAccept(path: string): boolean {
    let result = false;
    for (const patternSet of this.#patternSets) {
      result = this.#matchPatternSet(path, patternSet, result);
    }
    return result;
  }

  #matchPatternSet(path: string, patternSet: PatternSet, startResult: boolean): boolean {
    let result = startResult;
    for (const matcher of patternSet.acceptMatchers) {
      if (matcher.match(path)) {
        result = true;
        break;
      }
    }

    if ( ! result) {
      return false;
    }

    for (const matcher of patternSet.rejectMatchers) {
      if (matcher.match(path)) {
        return false;
      }
    }
    return true;
  }
}
