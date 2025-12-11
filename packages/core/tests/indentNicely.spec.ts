import { describe, it, expect } from 'bun:test';
import indentNicely from '../src/indentNicely/index.ts';

describe('indentNicely', () => {
  it('handles basic indentation', () => {
    const input = indentNicely`
      <div>
        <p>Hello, world!</p>
      </div>
    `;
    const expected = '<div>\n  <p>Hello, world!</p>\n</div>\n';
    expect(input).toBe(expected);
  });

  it('handles arrays of child nodes', () => {
    const items = ['apple', 'banana', 'cherry'];
    const input = indentNicely`
      <ul>
        ${items.map(item => `<li>${item}</li>`)}
      </ul>
    `;
    const expected = '<ul>\n  <li>apple</li>\n  <li>banana</li>\n  <li>cherry</li>\n</ul>\n';
    expect(input).toBe(expected);
  });

  it('converts strings containing newlines into proper indented output', () => {
    const newlines = '<li>one</li>\n<li>two</li>';
    const input = indentNicely`
      <ul>
        ${newlines}
        <li>three</li>
      </ul>
    `;
    const expected = '<ul>\n  <li>one</li>\n  <li>two</li>\n  <li>three</li>\n</ul>\n';
    expect(input).toBe(expected);
  });

  it('does not introduce excess newlines', () => {
    const newlines = '<li>one</li>\n<li>two</li>';
    const input = indentNicely`
      <h1>amaze</h1>
      <ul>

        <li>one</li>
        <li>two</li>
        <li>three</li>
      </ul>
    `;
    const expected = '<h1>amaze</h1>\n<ul>\n\n  <li>one</li>\n  <li>two</li>\n  <li>three</li>\n</ul>\n';
    expect(input).toBe(expected);
  });

  it('handles nested structures', () => {
    const fruits = ['apple', 'banana', 'kiwi'];
    const renderFruit = (fruit: string) => indentNicely`
      <li>
        <div>${fruit}</div>
      </li>
    `;
    const input = indentNicely`
      <html>
        <body>
          <ul>
            ${fruits.map(renderFruit)}
          </ul>
        </body>
      </html>
    `;
    const expected = '<html>\n  <body>\n    <ul>\n      <li>\n        <div>apple</div>\n      </li>\n      <li>\n        <div>banana</div>\n      </li>\n      <li>\n        <div>kiwi</div>\n      </li>\n    </ul>\n  </body>\n</html>\n';
    expect(input).toBe(expected);
  });

  it('handles empty arrays', () => {
    const input = indentNicely`
      <ul>${[]}</ul>
    `;
    const expected = '<ul></ul>\n';
    expect(input).toBe(expected);
  });

  it('handles empty arrays with surrounding newlines', () => {
    const input = indentNicely`
      <ul>
        ${[]}
      </ul>
    `;
    const expected = '<ul>\n\n</ul>\n';
    expect(input).toBe(expected);
  });

  it('handles arrays not on a new line', () => {
    const fruits = ['apple', 'banana', 'kiwi'];
    const input = indentNicely`
      <ul>${fruits.map(fruit => `<li>${fruit}</li>`)}</ul>
    `;
    const expected = '<ul><li>apple</li> <li>banana</li> <li>kiwi</li></ul>\n';
    expect(input).toBe(expected);
  });
});
