/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2024, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

import mount from 'utils/mount';
import { h, nextTick } from 'vue';

import TextHighlight from './TextHighlight.vue';

describe('TextHighlight', () => {
  let element;
  let destroy;

  async function render(props) {
    element = document.createElement('div');
    const mounted = mount({ render: () => h(TextHighlight, props) }, { element });
    destroy = mounted.destroy;
    await nextTick();

    return element.firstElementChild;
  }

  afterEach(() => {
    if (destroy) {
      destroy();
      destroy = undefined;
    }
  });

  it('wraps case-insensitive matches of the highlight term in a span', async () => {
    const span = await render({ text: '<p>Alpha alpha beta</p>', highlight: 'alpha' });

    expect(span.querySelectorAll('span.highlight').length).toBe(2);
    expect(span.textContent).toBe('Alpha alpha beta');
  });

  it('returns the text unchanged when there is no highlight term', async () => {
    const span = await render({ text: '<p>Alpha</p>', highlight: '' });

    expect(span.innerHTML).toBe('<p>Alpha</p>');
  });

  it('does not inject markup from the highlight term', async () => {
    const span = await render({
      text: '<p>hello &lt;img&gt;</p>',
      highlight: '<img src=x onerror="window.__xssHighlight = true">'
    });

    expect(span.querySelector('img')).toBeNull();
    expect(window.__xssHighlight).toBeUndefined();
    expect(span.textContent).toBe('hello <img>');
  });

  it('treats regular expression metacharacters in the term literally', async () => {
    const span = await render({
      text: '<p>cost: $5.00 (approx.)</p>',
      highlight: '$5.00 (approx.)'
    });

    expect(span.querySelectorAll('span.highlight').length).toBe(1);
    expect(span.querySelector('span.highlight').textContent).toBe('$5.00 (approx.)');
  });

  it('does not match inside tag attributes', async () => {
    const span = await render({
      text: '<a class="c-hyperlink" href="https://example.com/hyperlink">hyperlink</a>',
      highlight: 'hyperlink'
    });

    const anchor = span.querySelector('a');
    expect(anchor.getAttribute('class')).toBe('c-hyperlink');
    expect(anchor.getAttribute('href')).toBe('https://example.com/hyperlink');
    expect(anchor.querySelectorAll('span.highlight').length).toBe(1);
  });

  it('escapes the highlight class before rendering it as an attribute', async () => {
    const span = await render({
      text: '<p>alpha</p>',
      highlight: 'alpha',
      highlightClass: 'x" onmouseover="window.__xssClass = true'
    });

    const highlighted = span.querySelector('p span');
    expect(highlighted.getAttribute('onmouseover')).toBeNull();
    expect(window.__xssClass).toBeUndefined();
  });

  it('matches entity-encoded text such as ampersands', async () => {
    const span = await render({ text: '<p>Tom &amp; Jerry</p>', highlight: '&' });

    expect(span.querySelectorAll('span.highlight').length).toBe(1);
    expect(span.querySelector('span.highlight').textContent).toBe('&');
  });
});
