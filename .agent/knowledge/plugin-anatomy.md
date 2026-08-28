# Plugin Anatomy

## Minimum

```js
export default function MyPlugin(options) {
  return function install(openmct) {
    /* register types, providers, views, actions */
  };
}
```

## Recommended layout (feature-first)

```txt
src/plugins/myPlugin/
  plugin.js
  pluginSpec.js
  README.md
  MyProvider.js
  MyProviderSpec.js
  components/
    MyView.vue
  myPlugin.scss
```

## Registration

In `src/plugins/plugins.js`:

```js
import MyPlugin from './myPlugin/plugin.js';
plugins.MyPlugin = MyPlugin;
```

## Install (host page or test)

```js
openmct.install(openmct.plugins.MyPlugin(optionalConfig));
```
