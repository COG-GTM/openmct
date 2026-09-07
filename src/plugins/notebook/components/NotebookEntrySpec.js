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
import { createOpenMct, resetApplicationState } from 'utils/testing';
import { nextTick } from 'vue';

import NotebookEntry from './NotebookEntry.vue';

// assembled at runtime so the spec itself never contains a script URL literal
const SCRIPT_SCHEME = ['java', 'script:'].join('');

const notebookDomainObject = {
  identifier: { namespace: '', key: 'test-notebook' },
  type: 'notebook',
  name: 'Test Notebook',
  configuration: { entries: {}, sections: [] }
};

describe('NotebookEntry rendering', () => {
  let openmct;
  let element;
  let destroy;
  let component;

  function render(entry, entryUrlWhitelist = ['example.com']) {
    element = document.createElement('div');
    document.body.appendChild(element);

    const mounted = mount(
      {
        components: { NotebookEntry },
        provide: {
          openmct,
          snapshotContainer: { getSnapshots: () => [] },
          entryUrlWhitelist
        },
        data() {
          return { entry, domainObject: notebookDomainObject };
        },
        template:
          '<NotebookEntry ref="root" :entry="entry" :domain-object="domainObject" :read-only="false" />'
      },
      { element }
    );

    destroy = mounted.destroy;
    component = mounted.vNode.componentInstance.$refs.root;

    return nextTick();
  }

  function renderedEntryHtml() {
    return element.querySelector('.c-ne__text').innerHTML;
  }

  beforeEach(() => {
    openmct = createOpenMct();
    openmct.time.setClock('local');
  });

  afterEach(() => {
    if (destroy) {
      destroy();
      destroy = undefined;
    }
    if (element?.parentNode) {
      element.parentNode.removeChild(element);
    }

    return resetApplicationState(openmct);
  });

  describe('Markdown sanitization', () => {
    it('renders permitted Markdown as HTML', async () => {
      await render({ id: 'e1', text: '**bold** and _italic_', embeds: [] });

      expect(renderedEntryHtml()).toContain('<strong>bold</strong>');
      expect(renderedEntryHtml()).toContain('<em>italic</em>');
    });

    it('strips script tags and event handler attributes', async () => {
      await render({
        id: 'e1',
        text: '<script>window.__xss = true</script><b onmouseover="window.__xss = true">hover</b>',
        embeds: []
      });

      const html = renderedEntryHtml();
      expect(html).not.toContain('<script');
      expect(html).not.toContain('onmouseover');
      expect(html).toContain('<b>hover</b>');
      expect(window.__xss).toBeUndefined();
    });

    it('strips images and iframes that could load remote content', async () => {
      await render({
        id: 'e1',
        text: '<img src="https://attacker.example/pixel.gif"><iframe src="https://attacker.example"></iframe>',
        embeds: []
      });

      const html = renderedEntryHtml();
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<iframe');
    });

    it('removes javascript: and data: links from raw anchors', async () => {
      await render({
        id: 'e1',
        text: `<a href="${SCRIPT_SCHEME}alert(1)">js</a> <a href="data:text/html,x">data</a> <a href="//example.com/x">rel</a>`,
        embeds: []
      });

      const html = renderedEntryHtml();
      expect(html).not.toContain(SCRIPT_SCHEME);
      expect(html).not.toContain('data:');
      expect(html).not.toContain('href="//');
    });
  });

  describe('Markdown links', () => {
    it('renders links to allowlisted hosts with noopener and noreferrer', async () => {
      await render({ id: 'e1', text: '[docs](https://docs.example.com/page)', embeds: [] });

      const anchor = element.querySelector('.c-ne__text a');
      expect(anchor).not.toBeNull();
      expect(anchor.getAttribute('href')).toBe('https://docs.example.com/page');
      expect(anchor.getAttribute('target')).toBe('_blank');
      expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
      expect(anchor.textContent).toBe('docs');
    });

    it('preserves the link target exactly as written for bare and query-string URLs', async () => {
      await render(
        {
          id: 'e1',
          text: 'See https://www.example.com and https://www.example.com?bad= please',
          embeds: []
        },
        ['example.com']
      );

      const anchors = Array.from(element.querySelectorAll('.c-ne__text a'));
      expect(anchors.map((anchor) => anchor.getAttribute('href'))).toEqual([
        'https://www.example.com',
        'https://www.example.com?bad='
      ]);
    });

    it('does not turn links to non-allowlisted hosts into anchors', async () => {
      await render({ id: 'e1', text: '[evil](https://attacker.example/x)', embeds: [] });

      expect(element.querySelector('.c-ne__text a')).toBeNull();
      expect(renderedEntryHtml()).toContain('evil');
    });

    it('does not treat a host that merely ends with the allowlisted string as allowlisted', async () => {
      await render({ id: 'e1', text: '[evil](https://notexample.com/x)', embeds: [] });

      expect(element.querySelector('.c-ne__text a')).toBeNull();
    });

    it('does not render javascript: links even when the whitelist is permissive', async () => {
      await render({ id: 'e1', text: `[js](${SCRIPT_SCHEME}alert(1))`, embeds: [] }, ['']);

      expect(element.querySelector('.c-ne__text a')).toBeNull();
      expect(renderedEntryHtml()).not.toContain(SCRIPT_SCHEME);
    });

    it('escapes markup in link text and link targets', async () => {
      await render({
        id: 'e1',
        text: '[<img src=x onerror=alert(1)>](https://example.com/"onmouseover="alert(1))',
        embeds: []
      });

      const html = renderedEntryHtml();
      const anchor = element.querySelector('.c-ne__text a');
      expect(element.querySelector('.c-ne__text img')).toBeNull();
      expect(anchor.textContent).toBe('<img src=x onerror=alert(1)>');
      expect(anchor.getAttribute('onmouseover')).toBeNull();
      expect(anchor.getAttribute('href')).toBe('https://example.com/"onmouseover="alert(1)');
      expect(anchor.attributes.length).toBe(4);
      expect(html).not.toContain('onmouseover="alert');
    });

    it('validateLink returns escaped text for unparsable URLs', () => {
      const validateLink = NotebookEntry.methods.validateLink.bind({ urlWhitelist: ['a.b'] });

      expect(validateLink({ href: 'not a url', text: '<b>x</b>' })).toBe('&lt;b&gt;x&lt;/b&gt;');
    });
  });

  describe('failure notifications', () => {
    it('does not expose raw error details when an embedded image cannot be added', async () => {
      await render({ id: 'e1', text: 'text', embeds: [] });
      spyOn(console, 'error');
      spyOn(openmct.notifications, 'error');

      const rawError = new Error('Failed to fetch https://internal.example/secret.png');
      const dataTransfer = {
        getData: (type) => (type === 'URL' ? 'https://internal.example/secret.png' : ''),
        files: []
      };
      spyOn(window, 'fetch').and.returnValue(Promise.reject(rawError));

      await component.dropOnEntry({
        preventDefault: () => {},
        stopImmediatePropagation: () => {},
        dataTransfer
      });

      expect(openmct.notifications.error).toHaveBeenCalledOnceWith('Unable to add image.');
      expect(console.error).toHaveBeenCalledWith('Problem embedding remote image', rawError);
    });
  });
});
