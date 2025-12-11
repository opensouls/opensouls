import toString from './toString.ts';

export default function prefixLines(prefix: string, value: any, skipFirst: boolean = false): string {
  return toString(value)
    .split('\n')
    .map((line: string, index: number) =>
      skipFirst && index === 0 ? line : ''.concat(prefix, line),
    )
    .join('\n');
}
