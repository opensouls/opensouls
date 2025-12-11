import { splitSections } from './sectionSplitter.js';
import { FilePipeline } from '@opensouls/pipeline';

const run = async () => {
  const pipeline = new FilePipeline("backgroundInformation", "stores/default", { replace: true })
  await pipeline.process(async ({ content }) => {
    return splitSections(await content());
  })
}

export default run
