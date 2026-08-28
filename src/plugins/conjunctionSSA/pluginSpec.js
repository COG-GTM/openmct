import { createOpenMct, resetApplicationState } from 'utils/testing';

import { KEYS, NAMESPACE, PAIR_TYPE, TRACKED_TYPE } from './models.js';
import ConjunctionSSAPlugin from './plugin.js';
import { SEED_TLES } from './tles.js';

const FIXED_NOW_MS = Date.UTC(2024, 0, 1, 12, 0, 0);
const TEST_SEEDS = [
  SEED_TLES.find((tle) => tle.id === '25544'),
  SEED_TLES.find((tle) => tle.id === '99999'),
  SEED_TLES.find((tle) => tle.id === '20580')
];

describe('ConjunctionSSA plugin', () => {
  let openmct;
  let pluginFactory;

  beforeEach(() => {
    openmct = createOpenMct();
    pluginFactory = ConjunctionSSAPlugin({
      seeds: TEST_SEEDS,
      autoStart: false,
      now: () => FIXED_NOW_MS
    });
  });

  afterEach(() => {
    if (pluginFactory && pluginFactory.engine) {
      pluginFactory.engine.stop();
    }
    return resetApplicationState(openmct);
  });

  describe('before install', () => {
    beforeEach((done) => {
      openmct.on('start', done);
      openmct.startHeadless();
    });

    it('does not register the tracked object type', () => {
      expect(openmct.types.get(TRACKED_TYPE).key).toBe('unknown');
    });

    it('does not register the pair type', () => {
      expect(openmct.types.get(PAIR_TYPE).key).toBe('unknown');
    });

    it('does not expose the Conjunction SSA root', async () => {
      const rootCollection = openmct.composition.get({
        identifier: { namespace: '', key: 'ROOT' },
        type: 'root'
      });
      const rootChildren = await rootCollection.load();
      const ssaRoot = rootChildren.find(
        (child) => child.identifier.namespace === NAMESPACE && child.identifier.key === KEYS.root
      );
      expect(ssaRoot).toBeUndefined();
    });
  });

  describe('after install', () => {
    beforeEach((done) => {
      openmct.install(pluginFactory);
      openmct.on('start', done);
      openmct.startHeadless();
    });

    it('registers the Tracked Object type', () => {
      const type = openmct.types.get(TRACKED_TYPE);
      expect(type).toBeDefined();
      expect(type.definition.name).toBe('Tracked Object');
    });

    it('registers the Conjunction Pair type', () => {
      const type = openmct.types.get(PAIR_TYPE);
      expect(type).toBeDefined();
    });

    it('exposes a Conjunction SSA root object', async () => {
      const root = await openmct.objects.get({ namespace: NAMESPACE, key: KEYS.root });
      expect(root.name).toBe('Conjunction SSA');
      expect(root.type).toBe('folder');
      expect(root.composition.length).toBeGreaterThan(0);
    });

    it('exposes the Conjunction Watch condition set with three conditions', async () => {
      const watch = await openmct.objects.get({ namespace: NAMESPACE, key: KEYS.watch });
      expect(watch.type).toBe('conditionSet');
      const outputs = watch.configuration.conditionCollection.map((c) => c.configuration.output);
      expect(outputs).toEqual(['Maneuver review', 'Close approach', 'Nominal']);
    });

    it('exposes ranked table with the summary object first in composition', async () => {
      const table = await openmct.objects.get({ namespace: NAMESPACE, key: KEYS.table });
      expect(table.type).toBe('table');
      expect(table.composition[0].key).toBe(KEYS.summary);
    });

    it('exposes an overlay plot for miss distance', async () => {
      const plot = await openmct.objects.get({ namespace: NAMESPACE, key: KEYS.plot });
      expect(plot.type).toBe('telemetry.plot.overlay');
      expect(plot.composition.length).toBe((TEST_SEEDS.length * (TEST_SEEDS.length - 1)) / 2);
    });

    it('exposes an operator layout containing watch, table and plot subobjects', async () => {
      const layout = await openmct.objects.get({ namespace: NAMESPACE, key: KEYS.layout });
      expect(layout.type).toBe('layout');
      const ids = layout.configuration.items.map((item) => item.identifier?.key);
      expect(ids).toEqual([KEYS.watch, KEYS.table, KEYS.plot]);
    });

    it('provides tracked-object telemetry metadata with lat/lon/alt', async () => {
      const iss = await openmct.objects.get({ namespace: NAMESPACE, key: 'tracked-25544' });
      const metadata = openmct.telemetry.getMetadata(iss);
      const valueKeys = metadata.values().map((v) => v.key);
      expect(valueKeys).toContain('lat');
      expect(valueKeys).toContain('lon');
      expect(valueKeys).toContain('alt');
      expect(valueKeys).toContain('utc');
    });

    it('provides pair telemetry metadata with missKm and pc', async () => {
      const summary = await openmct.objects.get({ namespace: NAMESPACE, key: KEYS.summary });
      const metadata = openmct.telemetry.getMetadata(summary);
      const valueKeys = metadata.values().map((v) => v.key);
      expect(valueKeys).toContain('missKm');
      expect(valueKeys).toContain('pc');
      expect(valueKeys).toContain('tcaOffsetS');
    });

    it('streams tracked telemetry to subscribers', (done) => {
      openmct.objects.get({ namespace: NAMESPACE, key: 'tracked-25544' }).then((iss) => {
        const unsubscribe = openmct.telemetry.subscribe(iss, (datum) => {
          expect(datum.utc).toBe(FIXED_NOW_MS);
          expect(Number.isFinite(datum.lat)).toBeTrue();
          expect(datum.alt).toBeGreaterThan(300);
          unsubscribe();
          done();
        });
        pluginFactory.engine.tick();
      });
    });

    it('streams pair telemetry with a computed miss distance', (done) => {
      openmct.objects.get({ namespace: NAMESPACE, key: KEYS.summary }).then((summary) => {
        const unsubscribe = openmct.telemetry.subscribe(summary, (datum) => {
          expect(datum.missKm).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(datum.pc)).toBeTrue();
          unsubscribe();
          done();
        });
        pluginFactory.engine.tick();
      });
    });

    it('returns historical telemetry via request()', async () => {
      const iss = await openmct.objects.get({ namespace: NAMESPACE, key: 'tracked-25544' });
      pluginFactory.engine.tick();
      const history = await openmct.telemetry.request(iss, {
        start: FIXED_NOW_MS - 60_000,
        end: FIXED_NOW_MS + 60_000
      });
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].utc).toBe(FIXED_NOW_MS);
    });
  });
});
