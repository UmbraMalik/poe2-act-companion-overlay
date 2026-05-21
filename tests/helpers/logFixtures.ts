import { readText } from './loadJson';

export function loadLogFixtureText(name: string): string {
  return readText(`tests/fixtures/logs/${name}`);
}

export function loadLogFixtureLines(name: string): string[] {
  return loadLogFixtureText(name)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}
