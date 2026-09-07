<!--
 Open MCT, Copyright (c) 2014-2024, United States Government
 as represented by the Administrator of the National Aeronautics and Space
 Administration. All rights reserved.

 Open MCT is licensed under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0.

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 License for the specific language governing permissions and limitations
 under the License.

 Open MCT includes source code licensed under additional open source
 licenses. See the Open Source Licenses file (LICENSES.md) included with
 this source code distribution or the Licensing information page available
 at runtime from the About dialog for additional information.
-->
<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span v-html="highlightedText"></span>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      required: true
    },
    highlight: {
      type: String,
      default() {
        return '';
      }
    },
    highlightClass: {
      type: String,
      default() {
        return 'highlight';
      }
    }
  },
  computed: {
    /**
     * Wraps matches of `highlight` found in the text content of `text` (which
     * is expected to be already-sanitized HTML) in a span. The highlight term is
     * treated as a literal string, and the wrapped content is the matched text
     * itself, so no markup from the search term reaches the rendered HTML.
     */
    highlightedText() {
      const highlight = this.highlight;

      if (!highlight) {
        return this.text;
      }

      // text content inside sanitized HTML is entity-encoded, so encode the
      // search term the same way before looking for it
      const term = escapeRegExp(escapeHtml(highlight));
      const highlightRegex = new RegExp(`(?<!<[^>]*)(${term})`, 'gi');
      const replacement = `<span class="${escapeHtml(this.highlightClass)}">$1</span>`;

      return this.text.replace(highlightRegex, replacement);
    }
  }
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
</script>
