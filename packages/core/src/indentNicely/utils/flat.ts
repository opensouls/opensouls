export default function flat<T>(array: T[][]): T[] {
  return ([] as T[]).concat(...array);
}
