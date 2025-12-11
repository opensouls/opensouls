import toString from './toString.ts';

export default function stripLastNewLine(value: any): string {
  const stringValue: string = toString(value);
  const { length }: { length: number } = stringValue;
  return length > 0 && stringValue[length - 1] === '\n'
    ? stringValue.slice(0, length - 1)
    : stringValue;
}
