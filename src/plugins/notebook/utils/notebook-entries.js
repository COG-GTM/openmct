import { v4 as uuid } from 'uuid';

import objectLink from '../../../ui/mixins/object-link.js';
import {
  createNotebookImageDomainObject,
  getThumbnailURLFromImageUrl,
  saveNotebookImageDomainObject
} from './notebook-image.js';

async function getUsername(openmct) {
  let username = null;

  if (openmct.user.hasProvider()) {
    const user = await openmct.user.getCurrentUser();
    username = user.getName();
  }

  return username;
}

async function getActiveRole(openmct) {
  let role = null;
  if (openmct.user.hasProvider()) {
    role = await openmct.user.getActiveRole?.();
  }

  return role;
}

export const DEFAULT_CLASS = 'notebook-default';
const TIME_BOUNDS = {
  START_BOUND: 'tc.startBound',
  END_BOUND: 'tc.endBound',
  START_DELTA: 'tc.startDelta',
  END_DELTA: 'tc.endDelta'
};

export function addEntryIntoPage(notebookStorage, entries, entry) {
  const defaultSectionId = notebookStorage.defaultSectionId;
  const defaultPageId = notebookStorage.defaultPageId;
  if (!defaultSectionId || !defaultPageId) {
    return;
  }

  const newEntries = JSON.parse(JSON.stringify(entries));
  let section = newEntries[defaultSectionId];
  if (!section) {
    newEntries[defaultSectionId] = {};
  }

  let page = newEntries[defaultSectionId][defaultPageId];
  if (!page) {
    newEntries[defaultSectionId][defaultPageId] = [];
  }

  newEntries[defaultSectionId][defaultPageId].push(entry);

  return newEntries;
}

export function selectEntry({
  element,
  entryId,
  domainObject,
  openmct,
  onAnnotationChange,
  notebookAnnotations
}) {
  const keyString = openmct.objects.makeKeyString(domainObject.identifier);
  const targetDetails = [
    {
      entryId,
      keyString
    }
  ];
  const targetDomainObjects = [domainObject];
  openmct.selection.select(
    [
      {
        element,
        context: {
          type: 'notebook-entry-selection',
          item: domainObject,
          targetDetails,
          targetDomainObjects,
          annotations: notebookAnnotations,
          annotationType: openmct.annotation.ANNOTATION_TYPES.NOTEBOOK,
          onAnnotationChange
        }
      }
    ],
    false
  );
}

export function getHistoricLinkInFixedMode(openmct, bounds, historicLink) {
  if (historicLink.includes('tc.mode=fixed')) {
    return historicLink;
  }

  openmct.time.getAllClocks().forEach((clock) => {
    if (historicLink.includes(`tc.mode=${clock.key}`)) {
      historicLink.replace(`tc.mode=${clock.key}`, 'tc.mode=fixed');

      return;
    }
  });

  const params = historicLink.split('&').map((param) => {
    if (param.includes(TIME_BOUNDS.START_BOUND) || param.includes(TIME_BOUNDS.START_DELTA)) {
      param = `${TIME_BOUNDS.START_BOUND}=${bounds.start}`;
    }

    if (param.includes(TIME_BOUNDS.END_BOUND) || param.includes(TIME_BOUNDS.END_DELTA)) {
      param = `${TIME_BOUNDS.END_BOUND}=${bounds.end}`;
    }

    return param;
  });

  return params.join('&');
}

/**
 * Resolves with the new embed, or with `undefined` after notifying the operator
 * when the image could not be read, stored or reduced to a thumbnail.
 */
export function createNewImageEmbed(image, openmct, imageName = '') {
  return new Promise((resolve) => {
    const reader = new FileReader();
    function fail(error) {
      console.error(`${error?.message} - unable to embed image ${imageName}`, error);
      openmct.notifications.error('Unable to embed image.');
      resolve(undefined);
    }
    reader.onerror = () => fail(reader.error);
    reader.onload = async () => {
      const blobUrl = URL.createObjectURL(image);
      try {
        const base64Data = reader.result;
        // build the thumbnail first so a bad image never leaves an unreferenced
        // full-size image object in storage
        const imageThumbnailURL = await getThumbnailURLFromImageUrl(blobUrl);
        const imageDomainObject = createNotebookImageDomainObject(base64Data);
        await saveNotebookImageDomainObject(openmct, imageDomainObject);

        const snapshot = {
          fullSizeImageObjectIdentifier: imageDomainObject.identifier,
          thumbnailImage: {
            src: imageThumbnailURL
          }
        };

        const embedMetaData = {
          bounds: openmct.time.getBounds(),
          link: null,
          objectPath: null,
          openmct,
          userImage: true,
          imageName
        };

        const createdEmbed = await createNewEmbed(embedMetaData, snapshot);
        resolve(createdEmbed);
      } catch (error) {
        fail(error);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    };

    try {
      reader.readAsDataURL(image);
    } catch (error) {
      fail(error);
    }
  });
}

export async function createNewEmbed(snapshotMeta, snapshot = '') {
  const { bounds, link, objectPath, openmct, userImage } = snapshotMeta;
  let name = null;
  let type = null;
  let cssClass = 'icon-object-unknown';
  let domainObject = null;
  let historicLink = null;
  if (objectPath?.length > 0) {
    domainObject = objectPath[0];
    const domainObjectType = openmct.types.get(domainObject.type);
    cssClass = domainObjectType?.definition
      ? domainObjectType.definition.cssClass
      : 'icon-object-unknown';
    name = domainObject.name;
    type = domainObject.identifier.key;
    historicLink = link
      ? getHistoricLinkInFixedMode(openmct, bounds, link)
      : objectLink.computed.objectLink.call({
          objectPath,
          openmct
        });
  } else if (userImage) {
    cssClass = 'icon-image';
    name = snapshotMeta.imageName;
  }

  const date = openmct.time.now();
  const createdBy = await getUsername(openmct);

  return {
    bounds,
    createdOn: date,
    createdBy,
    cssClass,
    domainObject,
    historicLink,
    id: 'embed-' + date,
    name,
    snapshot,
    type
  };
}

export async function addNotebookEntry(
  openmct,
  domainObject,
  notebookStorage,
  passedEmbeds = [],
  entryText = ''
) {
  if (!openmct || !domainObject || !notebookStorage) {
    return;
  }

  const date = openmct.time.now();
  const configuration = domainObject.configuration;
  const entries = configuration.entries || {};
  // if embeds isn't an array, make it one
  const embedsNormalized =
    passedEmbeds && !Array.isArray(passedEmbeds) ? [passedEmbeds] : passedEmbeds;

  const id = `entry-${uuid()}`;
  const [createdBy, createdByRole] = await Promise.all([
    getUsername(openmct),
    getActiveRole(openmct)
  ]);
  const entry = {
    id,
    createdOn: date,
    createdBy,
    createdByRole,
    text: entryText,
    embeds: embedsNormalized
  };

  const newEntries = addEntryIntoPage(notebookStorage, entries, entry);

  addDefaultClass(domainObject, openmct);
  mutateObject(openmct, domainObject, 'configuration.entries', newEntries);
  openmct.audit?.record({
    action: 'notebook.entry.create',
    outcome: 'success',
    target: domainObject.identifier,
    details: {
      entryId: id,
      sectionId: notebookStorage.defaultSectionId ?? null,
      pageId: notebookStorage.defaultPageId ?? null,
      embedCount: embedsNormalized?.length ?? 0
    }
  });

  return id;
}

/**
 * Emits an audit record for the removal of a single notebook entry.
 * @param {import('openmct').OpenMCT} openmct
 * @param {import('openmct').DomainObject} domainObject the notebook
 * @param {string} entryId
 * @param {{id: string} | undefined} section
 * @param {{id: string} | undefined} page
 */
export function auditNotebookEntryDeletion(openmct, domainObject, entryId, section, page) {
  openmct.audit?.record({
    action: 'notebook.entry.delete',
    outcome: 'success',
    target: domainObject.identifier,
    details: {
      entryId,
      sectionId: section?.id ?? null,
      pageId: page?.id ?? null
    }
  });
}

export function getNotebookEntries(domainObject, selectedSection, selectedPage) {
  if (!domainObject || !selectedSection || !selectedPage || !domainObject.configuration) {
    return;
  }

  const configuration = domainObject.configuration;
  const entries = configuration.entries || {};

  let section = entries[selectedSection.id];
  if (!section) {
    return;
  }

  let page = entries[selectedSection.id][selectedPage.id];
  if (!page) {
    return;
  }

  const specificEntries = entries[selectedSection.id][selectedPage.id];

  return specificEntries;
}

export function getEntryPosById(entryId, domainObject, selectedSection, selectedPage) {
  if (!domainObject || !selectedSection || !selectedPage) {
    return;
  }

  const entries = getNotebookEntries(domainObject, selectedSection, selectedPage);
  let foundId = -1;
  entries.forEach((element, index) => {
    if (element.id === entryId) {
      foundId = index;

      return;
    }
  });

  return foundId;
}

export function deleteNotebookEntries(openmct, domainObject, selectedSection, selectedPage) {
  if (!domainObject || !selectedSection) {
    return;
  }

  const configuration = domainObject.configuration;
  const entries = configuration.entries || {};

  // Delete entire section
  if (!selectedPage) {
    const sectionEntryCount = Object.values(entries[selectedSection.id] ?? {}).reduce(
      (count, pageEntries) => count + (Array.isArray(pageEntries) ? pageEntries.length : 0),
      0
    );
    delete entries[selectedSection.id];
    openmct.audit?.record({
      action: 'notebook.entry.delete',
      outcome: 'success',
      target: domainObject.identifier,
      details: { sectionId: selectedSection.id, pageId: null, entryCount: sectionEntryCount }
    });

    return;
  }

  let section = entries[selectedSection.id];
  if (!section) {
    return;
  }

  const pageEntryCount = Array.isArray(section[selectedPage.id])
    ? section[selectedPage.id].length
    : 0;
  delete entries[selectedSection.id][selectedPage.id];

  mutateObject(openmct, domainObject, 'configuration.entries', entries);
  openmct.audit?.record({
    action: 'notebook.entry.delete',
    outcome: 'success',
    target: domainObject.identifier,
    details: { sectionId: selectedSection.id, pageId: selectedPage.id, entryCount: pageEntryCount }
  });
}

export function mutateObject(openmct, object, key, value) {
  openmct.objects.mutate(object, key, value);
}

function addDefaultClass(domainObject, openmct) {
  openmct.status.set(domainObject.identifier, DEFAULT_CLASS);
}
