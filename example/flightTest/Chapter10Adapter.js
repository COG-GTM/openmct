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

/* eslint-disable no-bitwise, max-classes-per-file */
// Bit masks are the natural way to express the packed header fields below.

/**
 * IRIG 106 Chapter 10 (now Chapter 11) packet adapter.
 *
 * Parses the 24 byte packet header common to every Chapter 10 packet and,
 * for MIL-STD-1553 Data Format 1 packets, the channel specific data word and
 * the intra-packet headers that precede each recorded bus message. It does
 * not decode PCM frames or 1553 command/status/data words; it extracts only
 * what is needed to route a packet to this plugin's telemetry keys and to
 * derive bus-health counters.
 *
 * Layout reference: RCC/IRIG 106-07 Chapter 10 "Digital Recording Standard"
 * paragraph 10.6.1 (Common Packet Elements) and 10.6.4 (MIL-STD-1553 Bus
 * Data Packets, Format 1), published at
 * https://www.irig106.org/docs/106-07/chapter10.pdf and
 * http://www.irig106.org/docs/106-07_html/10_6_1.phtml (packet header) and
 * http://www.irig106.org/docs/106-07_html/10_6_4.phtml (1553 Format 1). The
 * IRIG 106 Chapter 10 Programmers' Handbook
 * (http://irig106.org/wiki/ch10_handbook:data_file_interpretation) gives
 * the equivalent C structure used to cross-check the byte offsets below.
 *
 * All multi-byte fields are little-endian (10.6.1, Figure 10-6).
 *
 *   Packet header (24 bytes, 10.6.1.1):
 *     offset  0  uint16  Packet Sync Pattern, always 0xEB25
 *     offset  2  uint16  Channel ID (0x0000 reserved for computer generated data)
 *     offset  4  uint32  Packet Length, bytes, multiple of 4, includes header,
 *                        secondary header, body, filler and data checksum
 *     offset  8  uint32  Data Length, bytes of channel specific data,
 *                        intra-packet headers and data (no filler/checksum)
 *     offset 12  uint8   Data Type Version ("Header Version")
 *     offset 13  uint8   Sequence Number, wraps 0x00-0xFF per channel
 *     offset 14  uint8   Packet Flags
 *                          bit 7    secondary header present
 *                          bit 6    intra-packet time stamp source
 *                                   (0 = RTC, 1 = secondary header time)
 *                          bit 5    RTC sync error
 *                          bit 4    data overflow error
 *                          bits 3-2 secondary header time format
 *                          bits 1-0 data checksum: 00 none, 01 8-bit,
 *                                   10 16-bit, 11 32-bit
 *     offset 15  uint8   Data Type (0x09 PCM Format 1, 0x11 Time Format 1,
 *                        0x19 MIL-STD-1553 Format 1, ...)
 *     offset 16  uint48  Relative Time Counter, 10 MHz free-running counter
 *     offset 22  uint16  Header Checksum, 16-bit arithmetic sum of the
 *                        eleven preceding 16-bit header words, modulo 2^16
 *
 *   MIL-STD-1553 Format 1 packet body (10.6.4.2):
 *     Channel Specific Data Word (uint32):
 *       bits 23-0  message count in this packet
 *       bits 31-30 time tag bits (which bit of the message is time-tagged)
 *     Per message:
 *       uint64  intra-packet time stamp (RTC in the low 48 bits when packet
 *               flag bit 6 is 0)
 *       uint16  Block Status Word
 *                 bit 13  Bus ID: 0 = Bus A, 1 = Bus B
 *                 bit 12  Message Error
 *                 bit 11  RT-to-RT transfer
 *                 bit 10  Format Error
 *                 bit  9  Response Time Out
 *                 bit  5  Word Count Error
 *                 bit  4  Sync Type Error
 *                 bit  3  Invalid Word Error
 *       uint16  Gap Times Word (GAP1 low byte, GAP2 high byte, 0.1 us units)
 *       uint16  Length Word, bytes of 1553 words that follow
 *       ...     command/status/data words (not decoded here)
 */

export const SYNC_PATTERN = 0xeb25;
export const PACKET_HEADER_LENGTH = 24;
export const SECONDARY_HEADER_LENGTH = 12;
export const CHANNEL_SPECIFIC_DATA_LENGTH = 4;
export const INTRA_PACKET_TIME_STAMP_LENGTH = 8;
export const INTRA_PACKET_DATA_HEADER_LENGTH = 6;
export const MIL_STD_1553_FORMAT_1 = 0x19;
export const RTC_FREQUENCY_HZ = 10_000_000;
export const MAX_PACKET_LENGTH = 524_288;

export const DATA_TYPES = {
  0x00: 'Computer Generated Data, Format 0 (User Defined)',
  0x01: 'Computer Generated Data, Format 1 (Setup Record / TMATS)',
  0x02: 'Computer Generated Data, Format 2 (Recording Events)',
  0x03: 'Computer Generated Data, Format 3 (Recording Index)',
  0x09: 'PCM Data, Format 1',
  0x11: 'Time Data, Format 1',
  0x19: 'MIL-STD-1553 Data, Format 1',
  0x21: 'Analog Data, Format 1',
  0x29: 'Discrete Data, Format 1',
  0x30: 'Message Data, Format 0',
  0x38: 'ARINC 429 Data, Format 0',
  0x40: 'Video Data, Format 0',
  0x50: 'UART Data, Format 0'
};

export const DATA_CHECKSUM_TYPES = ['none', '8-bit', '16-bit', '32-bit'];

/**
 * Recorder channels used on the test article, mapped to the plugin's
 * telemetry object keys. A real installation would build this from the
 * TMATS setup record (Data Type 0x01) at the head of the recording.
 */
export const DEFAULT_CHANNEL_MAP = {
  0x0001: {
    name: 'Time',
    dataType: 0x11,
    keys: []
  },
  0x0010: {
    name: 'PCM Airframe',
    dataType: 0x09,
    keys: [
      'ta-01.pcm.altitude',
      'ta-01.pcm.airspeed',
      'ta-01.pcm.aoa',
      'ta-01.pcm.pitch',
      'ta-01.pcm.roll',
      'ta-01.pcm.yaw',
      'ta-01.pcm.nz'
    ]
  },
  0x0011: {
    name: 'PCM Propulsion',
    dataType: 0x09,
    keys: [
      'ta-01.pcm.n1',
      'ta-01.pcm.n2',
      'ta-01.pcm.egt',
      'ta-01.pcm.fuel-flow',
      'ta-01.pcm.fuel-quantity'
    ]
  },
  0x0020: {
    name: 'MIL-STD-1553 Avionics Bus A/B',
    dataType: MIL_STD_1553_FORMAT_1,
    keys: {
      A: [
        'ta-01.bus.a.message-rate',
        'ta-01.bus.a.word-errors',
        'ta-01.bus.a.no-response',
        'ta-01.bus.a.status'
      ],
      B: [
        'ta-01.bus.b.message-rate',
        'ta-01.bus.b.word-errors',
        'ta-01.bus.b.no-response',
        'ta-01.bus.b.status'
      ]
    }
  },
  0x0030: {
    name: 'TSPI',
    dataType: 0x30,
    keys: [
      'ta-01.tspi.latitude',
      'ta-01.tspi.longitude',
      'ta-01.tspi.altitude',
      'ta-01.tspi.ground-speed'
    ]
  }
};

export class Chapter10Error extends Error {
  constructor(message, offset) {
    super(offset === undefined ? message : `${message} (byte offset ${offset})`);
    this.name = 'Chapter10Error';
    this.offset = offset;
  }
}

function toDataView(source) {
  if (source instanceof DataView) {
    return source;
  }

  if (source instanceof ArrayBuffer) {
    return new DataView(source);
  }

  if (ArrayBuffer.isView(source)) {
    return new DataView(source.buffer, source.byteOffset, source.byteLength);
  }

  throw new Chapter10Error('Packet source must be an ArrayBuffer, DataView or typed array');
}

function requireBytes(view, offset, length, what) {
  if (!Number.isInteger(offset) || offset < 0 || offset + length > view.byteLength) {
    throw new Chapter10Error(`Truncated packet: ${what} needs ${length} bytes`, offset);
  }
}

/**
 * 16-bit arithmetic sum of the first eleven 16-bit words of the header,
 * modulo 2^16 (10.6.1.1 item 10).
 */
export function computeHeaderChecksum(view, offset = 0) {
  requireBytes(view, offset, PACKET_HEADER_LENGTH - 2, 'header checksum');

  let sum = 0;

  for (let i = 0; i < PACKET_HEADER_LENGTH - 2; i += 2) {
    sum = (sum + view.getUint16(offset + i, true)) & 0xffff;
  }

  return sum;
}

function readUint48(view, offset) {
  const low = view.getUint32(offset, true);
  const high = view.getUint16(offset + 4, true);

  return high * 0x1_0000_0000 + low;
}

/**
 * Parses the 24 byte packet header at `offset`.
 *
 * @param {ArrayBuffer|DataView|ArrayBufferView} source
 * @param {number} [offset]
 * @returns {object} decoded header fields plus `checksumValid`
 * @throws {Chapter10Error} if the buffer is too short, the sync pattern is
 *         wrong, or the length fields are inconsistent
 */
export function parsePacketHeader(source, offset = 0) {
  const view = toDataView(source);

  requireBytes(view, offset, PACKET_HEADER_LENGTH, 'packet header');

  const sync = view.getUint16(offset, true);

  if (sync !== SYNC_PATTERN) {
    throw new Chapter10Error(
      `Bad sync pattern 0x${sync.toString(16).padStart(4, '0').toUpperCase()}, expected 0xEB25`,
      offset
    );
  }

  const channelId = view.getUint16(offset + 2, true);
  const packetLength = view.getUint32(offset + 4, true);
  const dataLength = view.getUint32(offset + 8, true);
  const dataTypeVersion = view.getUint8(offset + 12);
  const sequenceNumber = view.getUint8(offset + 13);
  const packetFlags = view.getUint8(offset + 14);
  const dataType = view.getUint8(offset + 15);
  const relativeTimeCounter = readUint48(view, offset + 16);
  const headerChecksum = view.getUint16(offset + 22, true);

  const secondaryHeaderPresent = (packetFlags & 0x80) !== 0;
  const headerLength =
    PACKET_HEADER_LENGTH + (secondaryHeaderPresent ? SECONDARY_HEADER_LENGTH : 0);

  if (packetLength % 4 !== 0 || packetLength < headerLength || packetLength > MAX_PACKET_LENGTH) {
    throw new Chapter10Error(`Invalid packet length ${packetLength}`, offset + 4);
  }

  if (dataLength > packetLength - headerLength) {
    throw new Chapter10Error(
      `Data length ${dataLength} exceeds packet length ${packetLength}`,
      offset + 8
    );
  }

  return {
    sync,
    channelId,
    packetLength,
    dataLength,
    dataTypeVersion,
    sequenceNumber,
    packetFlags,
    flags: {
      secondaryHeaderPresent,
      intraPacketTimeFromSecondaryHeader: (packetFlags & 0x40) !== 0,
      rtcSyncError: (packetFlags & 0x20) !== 0,
      dataOverflowError: (packetFlags & 0x10) !== 0,
      secondaryHeaderTimeFormat: (packetFlags >> 2) & 0x03,
      dataChecksum: DATA_CHECKSUM_TYPES[packetFlags & 0x03]
    },
    dataType,
    dataTypeName: DATA_TYPES[dataType] ?? `Reserved (0x${dataType.toString(16)})`,
    relativeTimeCounter,
    relativeTimeSeconds: relativeTimeCounter / RTC_FREQUENCY_HZ,
    headerChecksum,
    checksumValid: headerChecksum === computeHeaderChecksum(view, offset),
    headerLength,
    bodyOffset: offset + headerLength
  };
}

/**
 * Decodes a MIL-STD-1553 Format 1 Block Status Word (10.6.4.2, Figure 10-20).
 */
export function parseBlockStatusWord(blockStatusWord) {
  const word = blockStatusWord & 0xffff;

  return {
    raw: word,
    busId: (word & 0x2000) !== 0 ? 'B' : 'A',
    messageError: (word & 0x1000) !== 0,
    rtToRtTransfer: (word & 0x0800) !== 0,
    formatError: (word & 0x0400) !== 0,
    responseTimeout: (word & 0x0200) !== 0,
    wordCountError: (word & 0x0020) !== 0,
    syncTypeError: (word & 0x0010) !== 0,
    invalidWordError: (word & 0x0008) !== 0
  };
}

/**
 * Parses the body of a MIL-STD-1553 Format 1 packet: the channel specific
 * data word followed by one intra-packet header per message. Message payload
 * words are skipped using each message's Length Word.
 *
 * @param {ArrayBuffer|DataView|ArrayBufferView} source
 * @param {object} header result of `parsePacketHeader`
 * @returns {{messageCount: number, timeTagBits: number, messages: Array<object>}}
 */
export function parse1553Format1Body(source, header) {
  const view = toDataView(source);

  if (header.dataType !== MIL_STD_1553_FORMAT_1) {
    throw new Chapter10Error(
      `Data type 0x${header.dataType.toString(16)} is not MIL-STD-1553 Format 1 (0x19)`
    );
  }

  const bodyStart = header.bodyOffset;
  const bodyEnd = bodyStart + header.dataLength;

  requireBytes(view, bodyStart, header.dataLength, 'packet body');
  requireBytes(view, bodyStart, CHANNEL_SPECIFIC_DATA_LENGTH, 'channel specific data word');

  const channelSpecificData = view.getUint32(bodyStart, true);
  const messageCount = channelSpecificData & 0x00ffffff;
  const timeTagBits = (channelSpecificData >>> 30) & 0x03;
  const messages = [];
  let cursor = bodyStart + CHANNEL_SPECIFIC_DATA_LENGTH;

  for (let index = 0; index < messageCount; index++) {
    const intraPacketHeaderLength =
      INTRA_PACKET_TIME_STAMP_LENGTH + INTRA_PACKET_DATA_HEADER_LENGTH;

    if (cursor + intraPacketHeaderLength > bodyEnd) {
      throw new Chapter10Error(
        `Message ${index} intra-packet header runs past data length`,
        cursor
      );
    }

    const intraPacketTimeStamp = readUint48(view, cursor);
    const blockStatusWord = view.getUint16(cursor + 8, true);
    const gapTimesWord = view.getUint16(cursor + 10, true);
    const lengthWord = view.getUint16(cursor + 12, true);
    const dataOffset = cursor + intraPacketHeaderLength;

    if (dataOffset + lengthWord > bodyEnd) {
      throw new Chapter10Error(
        `Message ${index} length ${lengthWord} runs past data length`,
        cursor + 12
      );
    }

    const status = parseBlockStatusWord(blockStatusWord);

    messages.push({
      index,
      intraPacketTimeStamp,
      ...status,
      gapTimes: {
        gap1TenthsMicroseconds: gapTimesWord & 0xff,
        gap2TenthsMicroseconds: (gapTimesWord >> 8) & 0xff
      },
      lengthBytes: lengthWord,
      wordCount: Math.floor(lengthWord / 2),
      dataOffset
    });

    cursor = dataOffset + lengthWord;
  }

  return { messageCount, timeTagBits, messages };
}

/**
 * Bus-health counters derived from the messages in one 1553 packet, keyed
 * by bus. `wordErrors` counts messages with any word-level error (message,
 * format, word count, sync or invalid word), matching what the test
 * article's `word-errors` parameters report.
 */
export function summarize1553Messages(messages) {
  const summary = {
    A: { messages: 0, wordErrors: 0, noResponse: 0, words: 0 },
    B: { messages: 0, wordErrors: 0, noResponse: 0, words: 0 }
  };

  messages.forEach((message) => {
    const bus = summary[message.busId];

    bus.messages += 1;
    bus.words += message.wordCount;

    if (message.responseTimeout) {
      bus.noResponse += 1;
    }

    if (
      message.messageError ||
      message.formatError ||
      message.wordCountError ||
      message.syncTypeError ||
      message.invalidWordError
    ) {
      bus.wordErrors += 1;
    }
  });

  return summary;
}

/**
 * Parses a single Chapter 10 packet and maps it to this plugin's telemetry
 * keys through a channel map.
 */
export default class Chapter10Adapter {
  constructor(channelMap = DEFAULT_CHANNEL_MAP) {
    this.channelMap = channelMap;
  }

  /**
   * Resolves the telemetry keys a channel feeds. For 1553 channels the
   * optional `busId` ('A' or 'B') selects the per-bus keys.
   *
   * @returns {string[]} telemetry object keys, empty when unmapped
   */
  keysForChannel(channelId, busId) {
    const channel = this.channelMap[channelId];

    if (channel === undefined) {
      return [];
    }

    if (Array.isArray(channel.keys)) {
      return [...channel.keys];
    }

    if (busId !== undefined && Array.isArray(channel.keys[busId])) {
      return [...channel.keys[busId]];
    }

    return Object.values(channel.keys).flat();
  }

  /**
   * Parses one packet starting at `offset`. The whole packet, as declared by
   * its Packet Length, must be present in the buffer and the header checksum
   * must verify; anything else is rejected rather than partially decoded.
   *
   * @returns {{header: object, channel: object|undefined, keys: string[],
   *   body: object|undefined, busHealth: object|undefined}}
   * @throws {Chapter10Error} on any header, checksum, length or body error
   */
  parsePacket(source, offset = 0) {
    const view = toDataView(source);
    const header = parsePacketHeader(view, offset);

    if (!header.checksumValid) {
      throw new Chapter10Error('Header checksum mismatch', offset + 22);
    }

    requireBytes(view, offset, header.packetLength, 'complete packet');

    const channel = this.channelMap[header.channelId];
    const result = {
      header,
      channel,
      keys: this.keysForChannel(header.channelId),
      body: undefined,
      busHealth: undefined
    };

    if (channel !== undefined && channel.dataType !== header.dataType) {
      throw new Chapter10Error(
        `Channel ${header.channelId} carries data type 0x${header.dataType.toString(
          16
        )} but the channel map expects 0x${channel.dataType.toString(16)}`,
        offset + 15
      );
    }

    if (header.dataType === MIL_STD_1553_FORMAT_1) {
      result.body = parse1553Format1Body(view, header);
      result.busHealth = summarize1553Messages(result.body.messages);
    }

    return result;
  }

  /**
   * Walks a buffer containing back-to-back packets, using each header's
   * Packet Length to find the next one.
   *
   * @returns {Array<object>} one `parsePacket` result per packet
   */
  parseStream(source) {
    const view = toDataView(source);
    const packets = [];
    let offset = 0;

    while (offset + PACKET_HEADER_LENGTH <= view.byteLength) {
      const packet = this.parsePacket(view, offset);

      packets.push(packet);
      offset += packet.header.packetLength;
    }

    if (offset !== view.byteLength) {
      throw new Chapter10Error('Trailing bytes after last complete packet', offset);
    }

    return packets;
  }
}
