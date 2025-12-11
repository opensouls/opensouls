import * as React from 'react';
import { describe, expect, test } from 'bun:test'
import { render } from './shared/render';
import { SoulsProvider } from "../src/components/SoulsProvider";

describe('SoulsProvider', () => {
  test('renders', async () => {
    const root = await render(
      <SoulsProvider organization='test'>
        <div>Test</div>
      </SoulsProvider>
    )

    expect(root.innerHTML).toBe('<div>Test</div>');
  });
});