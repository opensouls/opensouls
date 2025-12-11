import { expect } from 'chai';

import { ContentStreamer } from '../../src/soul/content-streamer.ts';

describe('ContentStreamer', () => {
  it('should stream content as it is updated', async () => {
    const contentStreamer = new ContentStreamer();
    const messages:string[] = [];

    const streamPromise = (async () => {
      for await (const message of contentStreamer.stream()) {
        messages.push(message);
      }
    })();

    contentStreamer.updateContent('Hello');
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    contentStreamer.updateContent('Hello World');
    contentStreamer.complete();

    await streamPromise;

    expect(messages).to.deep.equal(['Hello', ' World']);
  });

  it('should handle empty updates gracefully', async () => {
    const contentStreamer = new ContentStreamer();
    const messages:string[] = [];

    const streamPromise = (async () => {
      for await (const message of contentStreamer.stream()) {
        messages.push(message);
      }
    })();

    contentStreamer.updateContent('');
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    contentStreamer.updateContent('Test');
    contentStreamer.complete();

    await streamPromise;

    expect(messages).to.deep.equal(['Test']);
  });

  it('should complete the stream when complete is called', async () => {
    const contentStreamer = new ContentStreamer();
    let streamFinished = false;

    const streamPromise = (async () => {
      for await (const message of contentStreamer.stream()) {
        expect(message).to.be.a('string');
        // messages would be processed here
      }

      streamFinished = true;
    })();

    contentStreamer.complete();

    await streamPromise;

    expect(streamFinished).to.be.true;
  });
});
