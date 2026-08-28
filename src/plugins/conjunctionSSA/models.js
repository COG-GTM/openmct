const NAMESPACE = 'conjunction.ssa';

const KEYS = {
  root: 'root',
  trackedFolder: 'tracked-folder',
  pairFolder: 'pair-folder',
  watch: 'conjunction-watch',
  table: 'ranked-conjunctions-table',
  plot: 'miss-distance-plot',
  layout: 'operator-layout',
  summary: 'pair-summary'
};

const TRACKED_TYPE = 'conjunction.ssa.tracked-object';
const PAIR_TYPE = 'conjunction.ssa.pair';

const RED_MISS_KM = 5;
const RED_PC = 1e-4;
const YELLOW_MISS_KM = 25;
const YELLOW_PC = 1e-6;

function id(key) {
  return { namespace: NAMESPACE, key };
}

function trackedKey(seedId) {
  return `tracked-${seedId}`;
}

function pairIdentifierKey(pairKey) {
  return `pair-${pairKey}`;
}

function buildTrackedObject(seed) {
  return {
    identifier: id(trackedKey(seed.id)),
    name: seed.name,
    type: TRACKED_TYPE,
    location: `${NAMESPACE}:${KEYS.trackedFolder}`,
    telemetry: {
      catalogNumber: seed.id,
      group: seed.group,
      tle1: seed.tle1,
      tle2: seed.tle2
    }
  };
}

function buildPairObject(pair) {
  return {
    identifier: id(pairIdentifierKey(pair.key)),
    name: `${pair.primaryId} × ${pair.secondaryId}`,
    type: PAIR_TYPE,
    location: `${NAMESPACE}:${KEYS.pairFolder}`,
    telemetry: {
      primary: pair.primaryId,
      secondary: pair.secondaryId,
      pairKey: pair.key
    }
  };
}

function buildSummaryObject() {
  return {
    identifier: id(KEYS.summary),
    name: 'Worst-Case Conjunction',
    type: PAIR_TYPE,
    location: `${NAMESPACE}:${KEYS.root}`,
    telemetry: {
      pairKey: 'summary'
    }
  };
}

function buildWatchConditionSet() {
  const summaryId = id(KEYS.summary);
  return {
    identifier: id(KEYS.watch),
    name: 'Conjunction Watch',
    type: 'conditionSet',
    location: `${NAMESPACE}:${KEYS.root}`,
    composition: [summaryId],
    telemetry: {},
    configuration: {
      shouldFetchHistorical: false,
      conditionTestData: [],
      conditionCollection: [
        {
          id: 'conjunction-red',
          configuration: {
            name: 'RED - Maneuver review',
            output: 'Maneuver review',
            trigger: 'all',
            criteria: [
              {
                id: 'red-miss',
                telemetry: summaryId,
                operation: 'lessThan',
                input: [RED_MISS_KM],
                metadata: 'missKm'
              },
              {
                id: 'red-pc',
                telemetry: summaryId,
                operation: 'greaterThan',
                input: [RED_PC],
                metadata: 'pc'
              }
            ]
          },
          summary: `miss < ${RED_MISS_KM} km AND Pc > ${RED_PC}`
        },
        {
          id: 'conjunction-yellow',
          configuration: {
            name: 'YELLOW - Close',
            output: 'Close approach',
            trigger: 'any',
            criteria: [
              {
                id: 'yellow-miss',
                telemetry: summaryId,
                operation: 'lessThan',
                input: [YELLOW_MISS_KM],
                metadata: 'missKm'
              },
              {
                id: 'yellow-pc',
                telemetry: summaryId,
                operation: 'greaterThan',
                input: [YELLOW_PC],
                metadata: 'pc'
              }
            ]
          },
          summary: `miss < ${YELLOW_MISS_KM} km OR Pc > ${YELLOW_PC}`
        },
        {
          isDefault: true,
          id: 'conjunction-green',
          configuration: {
            name: 'GREEN - Nominal',
            output: 'Nominal',
            trigger: 'all',
            criteria: []
          },
          summary: 'No pair meets close-approach thresholds.'
        }
      ]
    }
  };
}

function buildTableObject(pairIdentifiers) {
  return {
    identifier: id(KEYS.table),
    name: 'Ranked Conjunctions',
    type: 'table',
    location: `${NAMESPACE}:${KEYS.root}`,
    composition: pairIdentifiers,
    configuration: {
      columnWidths: {},
      hiddenColumns: {},
      columnOrder: [],
      cellFormat: {},
      autosize: true
    }
  };
}

function buildPlotObject(pairIdentifiers) {
  return {
    identifier: id(KEYS.plot),
    name: 'Miss Distance vs Time',
    type: 'telemetry.plot.overlay',
    location: `${NAMESPACE}:${KEYS.root}`,
    composition: pairIdentifiers,
    configuration: {
      series: [],
      yAxis: {
        label: 'Miss Distance (km)',
        autoscale: true
      },
      xAxis: {}
    }
  };
}

function buildLayoutObject() {
  const watchId = id(KEYS.watch);
  const tableId = id(KEYS.table);
  const plotId = id(KEYS.plot);
  return {
    identifier: id(KEYS.layout),
    name: 'Conjunction Operator Layout',
    type: 'layout',
    location: `${NAMESPACE}:${KEYS.root}`,
    composition: [watchId, tableId, plotId],
    configuration: {
      items: [
        {
          type: 'subobject-view',
          id: 'watch-item',
          identifier: watchId,
          x: 0,
          y: 0,
          width: 30,
          height: 12,
          hasFrame: true,
          fontSize: 'default',
          font: 'default'
        },
        {
          type: 'subobject-view',
          id: 'table-item',
          identifier: tableId,
          x: 30,
          y: 0,
          width: 60,
          height: 30,
          hasFrame: true,
          fontSize: 'default',
          font: 'default'
        },
        {
          type: 'subobject-view',
          id: 'plot-item',
          identifier: plotId,
          x: 0,
          y: 12,
          width: 30,
          height: 30,
          hasFrame: true,
          fontSize: 'default',
          font: 'default'
        }
      ],
      layoutGrid: [10, 10],
      objectStyles: {}
    }
  };
}

function buildTrackedFolder(trackedIdentifiers) {
  return {
    identifier: id(KEYS.trackedFolder),
    name: 'Tracked Objects',
    type: 'folder',
    location: `${NAMESPACE}:${KEYS.root}`,
    composition: trackedIdentifiers
  };
}

function buildPairFolder(pairIdentifiers) {
  return {
    identifier: id(KEYS.pairFolder),
    name: 'Conjunction Pairs',
    type: 'folder',
    location: `${NAMESPACE}:${KEYS.root}`,
    composition: pairIdentifiers
  };
}

function buildRoot(childrenIdentifiers) {
  return {
    identifier: id(KEYS.root),
    name: 'Conjunction SSA',
    type: 'folder',
    location: 'ROOT',
    composition: childrenIdentifiers
  };
}

function buildAllModels(seeds, pairs) {
  const trackedObjects = seeds.map(buildTrackedObject);
  const trackedIdentifiers = trackedObjects.map((o) => o.identifier);
  const pairObjects = pairs.map(buildPairObject);
  const pairIdentifiers = pairObjects.map((o) => o.identifier);
  const summary = buildSummaryObject();
  const trackedFolder = buildTrackedFolder(trackedIdentifiers);
  const pairFolder = buildPairFolder(pairIdentifiers);
  const watch = buildWatchConditionSet();
  const table = buildTableObject([summary.identifier, ...pairIdentifiers]);
  const plot = buildPlotObject(pairIdentifiers);
  const layout = buildLayoutObject();
  const root = buildRoot([
    trackedFolder.identifier,
    pairFolder.identifier,
    watch.identifier,
    table.identifier,
    plot.identifier,
    layout.identifier
  ]);

  const map = new Map();
  function insert(obj) {
    map.set(obj.identifier.key, obj);
  }
  insert(root);
  insert(trackedFolder);
  insert(pairFolder);
  insert(watch);
  insert(table);
  insert(plot);
  insert(layout);
  insert(summary);
  trackedObjects.forEach(insert);
  pairObjects.forEach(insert);
  return map;
}

export {
  buildAllModels,
  buildLayoutObject,
  buildPairObject,
  buildRoot,
  buildSummaryObject,
  buildTrackedObject,
  buildWatchConditionSet,
  id,
  KEYS,
  NAMESPACE,
  PAIR_TYPE,
  pairIdentifierKey,
  RED_MISS_KM,
  RED_PC,
  TRACKED_TYPE,
  trackedKey,
  YELLOW_MISS_KM,
  YELLOW_PC
};
