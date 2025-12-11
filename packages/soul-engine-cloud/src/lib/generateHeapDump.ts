import { heapStats } from "bun:jsc";
import { generateHeapSnapshot } from "bun";

export default async function generateHeapDump(fileName="data/heap-dump.json") {
  console.log(`##### Running garbage collection and generating heap dump`);

  Bun.gc(true);

  await new Promise(resolve => setTimeout(resolve, 1000));
  
  Bun.gc(true);
  
  await new Promise(resolve => setTimeout(resolve, 1000));

  const snapshot = generateHeapSnapshot();
  await Bun.write(fileName, JSON.stringify(snapshot, null, 2));  

  console.log(heapStats());
  console.log(`##### Heap dump saved to ${fileName}`);
}
