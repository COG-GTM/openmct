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

/* eslint-disable no-bitwise */

import Chapter10Adapter, {
  Chapter10Error,
  computeHeaderChecksum,
  DEFAULT_CHANNEL_MAP,
  MIL_STD_1553_FORMAT_1,
  PACKET_HEADER_LENGTH,
  parse1553Format1Body,
  parseBlockStatusWord,
  parsePacketHeader,
  summarize1553Messages,
  SYNC_PATTERN
} from './Chapter10Adapter.js';

const BUS_B = 0x2000;
const MESSAGE_ERROR = 0x1000;
const FORMAT_ERROR = 0x0400;
const RESPONSE_TIMEOUT = 0x0200;
const WORD_COUNT_ERROR = 0x0020;

/**
 * Builds a 1553 Format 1 message: 8 byte time stamp, block status word,
 * gap times word, length word, then `wordCount` 16-bit data words.
 */
function build1553Message({ timeStamp = 0, blockStatus = 0, gapTimes = 0x0800, wordCount = 3 }) {
  const lengthBytes = wordCount * 2;
  const buffer = new ArrayBuffer(8 + 6 + lengthBytes);
  const view = new DataView(buffer);

  view.setUint32(0, timeStamp >>> 0, true);
  view.setUint32(4, 0, true);
  view.setUint16(8, blockStatus, true);
  view.setUint16(10, gapTimes, true);
  view.setUint16(12, lengthBytes, true);

  for (let i = 0; i < wordCount; i++) {
    view.setUint16(14 + i * 2, 0x1000 + i, true);
  }

  return new Uint8Array(buffer);
}

function build1553Body(messages, timeTagBits = 0) {
  const payload = messages.map((message) => build1553Message(message));
  const payloadLength = payload.reduce((total, bytes) => total + bytes.byteLength, 0);
  const body = new Uint8Array(4 + payloadLength);
  const view = new DataView(body.buffer);

  view.setUint32(0, ((timeTagBits & 0x03) << 30) | (messages.length & 0x00ffffff), true);

  let cursor = 4;
  payload.forEach((bytes) => {
    body.set(bytes, cursor);
    cursor += bytes.byteLength;
  });

  return body;
}

/**
 * Builds a complete packet: 24 byte header, optional body, filler to a
 * multiple of four bytes. The header checksum is computed unless a value is
 * supplied explicitly (to test corruption handling).
 */
function buildPacket({
  sync = SYNC_PATTERN,
  channelId = 0x0020,
  dataType = MIL_STD_1553_FORMAT_1,
  dataTypeVersion = 0x05,
  sequenceNumber = 0x2a,
  packetFlags = 0x00,
  relativeTimeCounter = 0,
  body = new Uint8Array(0),
  dataLength = body.byteLength,
  packetLength,
  headerChecksum
}) {
  const unpaddedLength = PACKET_HEADER_LENGTH + body.byteLength;
  const paddedLength = Math.ceil(unpaddedLength / 4) * 4;
  const totalLength = packetLength ?? paddedLength;
  const packet = new Uint8Array(Math.max(totalLength, paddedLength));
  const view = new DataView(packet.buffer);

  view.setUint16(0, sync, true);
  view.setUint16(2, channelId, true);
  view.setUint32(4, totalLength, true);
  view.setUint32(8, dataLength, true);
  view.setUint8(12, dataTypeVersion);
  view.setUint8(13, sequenceNumber);
  view.setUint8(14, packetFlags);
  view.setUint8(15, dataType);
  view.setUint32(16, relativeTimeCounter % 0x1_0000_0000, true);
  view.setUint16(20, Math.floor(relativeTimeCounter / 0x1_0000_0000), true);
  view.setUint16(22, headerChecksum ?? computeHeaderChecksum(view), true);
  packet.set(body, PACKET_HEADER_LENGTH);

  return packet;
}

describe('The IRIG 106 Chapter 10 adapter', () => {
  describe('packet header parsing', () => {
    let packet;
    let header;

    beforeEach(() => {
      packet = buildPacket({
        channelId: 0x0010,
        dataType: 0x09,
        dataTypeVersion: 0x04,
        sequenceNumber: 0x7f,
        packetFlags: 0b1011_0110,
        relativeTimeCounter: 0x0123_4567_89ab,
        // 12-byte secondary header (zeros) followed by 8 data bytes
        body: new Uint8Array([...new Array(12).fill(0), 1, 2, 3, 4, 5, 6, 7, 8]),
        dataLength: 8
      });
      header = parsePacketHeader(packet.buffer);
    });

    it('decodes every fixed header field little-endian', () => {
      expect(header.sync).toBe(0xeb25);
      expect(header.channelId).toBe(0x0010);
      expect(header.packetLength).toBe(44);
      expect(header.dataLength).toBe(8);
      expect(header.dataTypeVersion).toBe(0x04);
      expect(header.sequenceNumber).toBe(0x7f);
      expect(header.packetFlags).toBe(0b1011_0110);
      expect(header.dataType).toBe(0x09);
      expect(header.dataTypeName).toBe('PCM Data, Format 1');
    });

    it('decodes the 48-bit relative time counter', () => {
      expect(header.relativeTimeCounter).toBe(0x0123_4567_89ab);
      expect(header.relativeTimeSeconds).toBeCloseTo(0x0123_4567_89ab / 10_000_000, 6);
    });

    it('decodes the packet flag bits', () => {
      expect(header.flags.secondaryHeaderPresent).toBe(true);
      expect(header.flags.intraPacketTimeFromSecondaryHeader).toBe(false);
      expect(header.flags.rtcSyncError).toBe(true);
      expect(header.flags.dataOverflowError).toBe(true);
      expect(header.flags.secondaryHeaderTimeFormat).toBe(0b01);
      expect(header.flags.dataChecksum).toBe('16-bit');
      expect(header.headerLength).toBe(36);
      expect(header.bodyOffset).toBe(36);
    });

    it('validates the header checksum', () => {
      expect(header.checksumValid).toBe(true);

      const corrupt = buildPacket({ headerChecksum: 0x0000 });
      expect(parsePacketHeader(corrupt.buffer).checksumValid).toBe(false);
    });

    it('computes the checksum as a 16-bit sum of the first eleven words', () => {
      const view = new DataView(packet.buffer);
      let expected = 0;

      for (let i = 0; i < 22; i += 2) {
        expected = (expected + view.getUint16(i, true)) & 0xffff;
      }

      expect(computeHeaderChecksum(view)).toBe(expected);
      expect(view.getUint16(22, true)).toBe(expected);
    });

    it('accepts an ArrayBuffer, a DataView or a typed array', () => {
      const fromView = parsePacketHeader(new DataView(packet.buffer));
      const fromTyped = parsePacketHeader(packet);

      expect(fromView.channelId).toBe(header.channelId);
      expect(fromTyped.relativeTimeCounter).toBe(header.relativeTimeCounter);
    });

    it('parses a header at a non-zero offset inside a larger buffer', () => {
      const padded = new Uint8Array(8 + packet.byteLength);
      padded.set(packet, 8);

      expect(parsePacketHeader(padded.buffer, 8).sequenceNumber).toBe(0x7f);
    });

    it('rejects an invalid sync pattern', () => {
      const bad = buildPacket({ sync: 0x25eb });

      expect(() => parsePacketHeader(bad.buffer)).toThrowError(Chapter10Error, /sync pattern/i);
    });

    it('rejects a buffer shorter than the header', () => {
      expect(() => parsePacketHeader(new ArrayBuffer(23))).toThrowError(
        Chapter10Error,
        /truncated/i
      );
    });

    it('rejects packet lengths that are not multiples of four or shorter than the header', () => {
      const odd = buildPacket({ packetLength: 30 });
      const short = buildPacket({ packetLength: 20 });

      expect(() => parsePacketHeader(odd.buffer)).toThrowError(Chapter10Error, /packet length/i);
      expect(() => parsePacketHeader(short.buffer)).toThrowError(Chapter10Error, /packet length/i);
    });

    it('rejects a data length that overruns the packet', () => {
      const overrun = buildPacket({ body: new Uint8Array(8), dataLength: 9 });

      expect(() => parsePacketHeader(overrun.buffer)).toThrowError(Chapter10Error, /data length/i);
    });

    it('rejects sources that are not binary buffers', () => {
      expect(() => parsePacketHeader('EB25')).toThrowError(Chapter10Error);
      expect(() => parsePacketHeader(undefined)).toThrowError(Chapter10Error);
    });
  });

  describe('MIL-STD-1553 Format 1 parsing', () => {
    it('decodes the block status word bit fields', () => {
      const status = parseBlockStatusWord(
        BUS_B | MESSAGE_ERROR | FORMAT_ERROR | RESPONSE_TIMEOUT | WORD_COUNT_ERROR
      );

      expect(status.busId).toBe('B');
      expect(status.messageError).toBe(true);
      expect(status.formatError).toBe(true);
      expect(status.responseTimeout).toBe(true);
      expect(status.wordCountError).toBe(true);
      expect(status.syncTypeError).toBe(false);
      expect(status.invalidWordError).toBe(false);
      expect(status.rtToRtTransfer).toBe(false);
      expect(parseBlockStatusWord(0x0000).busId).toBe('A');
    });

    it('extracts bus ID, error flags and word count for each message', () => {
      const body = build1553Body(
        [
          { timeStamp: 1000, blockStatus: 0, wordCount: 4 },
          { timeStamp: 2000, blockStatus: BUS_B | MESSAGE_ERROR | WORD_COUNT_ERROR, wordCount: 6 },
          { timeStamp: 3000, blockStatus: BUS_B | RESPONSE_TIMEOUT, wordCount: 1 }
        ],
        0b10
      );
      const packet = buildPacket({ body });
      const header = parsePacketHeader(packet.buffer);
      const parsed = parse1553Format1Body(packet.buffer, header);

      expect(parsed.messageCount).toBe(3);
      expect(parsed.timeTagBits).toBe(0b10);
      expect(parsed.messages.length).toBe(3);

      expect(parsed.messages[0]).toEqual(
        jasmine.objectContaining({
          index: 0,
          intraPacketTimeStamp: 1000,
          busId: 'A',
          messageError: false,
          wordCount: 4,
          lengthBytes: 8
        })
      );
      expect(parsed.messages[1]).toEqual(
        jasmine.objectContaining({
          busId: 'B',
          messageError: true,
          wordCountError: true,
          wordCount: 6
        })
      );
      expect(parsed.messages[2]).toEqual(
        jasmine.objectContaining({
          busId: 'B',
          responseTimeout: true,
          wordCount: 1
        })
      );
      expect(parsed.messages[1].gapTimes).toEqual({
        gap1TenthsMicroseconds: 0x00,
        gap2TenthsMicroseconds: 0x08
      });
    });

    it('advances past each message using its length word', () => {
      const body = build1553Body([{ wordCount: 2 }, { wordCount: 5 }]);
      const packet = buildPacket({ body });
      const parsed = parse1553Format1Body(packet.buffer, parsePacketHeader(packet.buffer));
      const first = parsed.messages[0];
      const second = parsed.messages[1];

      expect(second.dataOffset).toBe(first.dataOffset + first.lengthBytes + 14);
    });

    it('summarizes per-bus health counters', () => {
      const body = build1553Body([
        { blockStatus: 0, wordCount: 2 },
        { blockStatus: 0, wordCount: 2 },
        { blockStatus: BUS_B | FORMAT_ERROR, wordCount: 3 },
        { blockStatus: BUS_B | RESPONSE_TIMEOUT, wordCount: 1 }
      ]);
      const packet = buildPacket({ body });
      const parsed = parse1553Format1Body(packet.buffer, parsePacketHeader(packet.buffer));

      expect(summarize1553Messages(parsed.messages)).toEqual({
        A: { messages: 2, wordErrors: 0, noResponse: 0, words: 4 },
        B: { messages: 2, wordErrors: 1, noResponse: 1, words: 4 }
      });
    });

    it('rejects a message whose intra-packet header runs past the data length', () => {
      const body = build1553Body([{ wordCount: 2 }]);
      const view = new DataView(body.buffer);
      view.setUint32(0, 2, true);
      const packet = buildPacket({ body });

      expect(() =>
        parse1553Format1Body(packet.buffer, parsePacketHeader(packet.buffer))
      ).toThrowError(Chapter10Error, /runs past data length/i);
    });

    it('rejects a message whose length word runs past the data length', () => {
      const body = build1553Body([{ wordCount: 2 }]);
      const view = new DataView(body.buffer);
      view.setUint16(4 + 12, 400, true);
      const packet = buildPacket({ body });

      expect(() =>
        parse1553Format1Body(packet.buffer, parsePacketHeader(packet.buffer))
      ).toThrowError(Chapter10Error, /length 400/);
    });

    it('rejects packets of another data type', () => {
      const packet = buildPacket({ dataType: 0x09, channelId: 0x0010 });

      expect(() =>
        parse1553Format1Body(packet.buffer, parsePacketHeader(packet.buffer))
      ).toThrowError(Chapter10Error, /not MIL-STD-1553/i);
    });
  });

  describe('channel mapping', () => {
    let adapter;

    beforeEach(() => {
      adapter = new Chapter10Adapter();
    });

    it('maps PCM channels to their telemetry keys', () => {
      expect(adapter.keysForChannel(0x0010)).toEqual(DEFAULT_CHANNEL_MAP[0x0010].keys);
      expect(adapter.keysForChannel(0x0011)).toContain('ta-01.pcm.egt');
    });

    it('maps the 1553 channel to per-bus telemetry keys', () => {
      expect(adapter.keysForChannel(0x0020, 'A')).toEqual([
        'ta-01.bus.a.message-rate',
        'ta-01.bus.a.word-errors',
        'ta-01.bus.a.no-response',
        'ta-01.bus.a.status'
      ]);
      expect(adapter.keysForChannel(0x0020, 'B')).toContain('ta-01.bus.b.status');
      expect(adapter.keysForChannel(0x0020).length).toBe(8);
    });

    it('returns no keys for an unmapped channel', () => {
      expect(adapter.keysForChannel(0x0999)).toEqual([]);
    });

    it('parses a 1553 packet end to end into bus health', () => {
      const body = build1553Body([
        { blockStatus: 0, wordCount: 3 },
        { blockStatus: BUS_B | MESSAGE_ERROR, wordCount: 3 }
      ]);
      const packet = buildPacket({ body, channelId: 0x0020 });
      const result = adapter.parsePacket(packet.buffer);

      expect(result.channel.name).toBe('MIL-STD-1553 Avionics Bus A/B');
      expect(result.keys.length).toBe(8);
      expect(result.body.messageCount).toBe(2);
      expect(result.busHealth.B.wordErrors).toBe(1);
      expect(result.busHealth.A.messages).toBe(1);
    });

    it('does not decode the body of PCM packets', () => {
      const packet = buildPacket({
        channelId: 0x0010,
        dataType: 0x09,
        body: new Uint8Array(16)
      });
      const result = adapter.parsePacket(packet.buffer);

      expect(result.body).toBeUndefined();
      expect(result.busHealth).toBeUndefined();
      expect(result.keys).toContain('ta-01.pcm.nz');
    });

    it('rejects a packet with a header checksum mismatch', () => {
      const packet = buildPacket({ channelId: 0x0010, dataType: 0x09, headerChecksum: 0x0000 });

      expect(() => adapter.parsePacket(packet.buffer)).toThrowError(
        Chapter10Error,
        /checksum mismatch \(byte offset 22\)/i
      );
    });

    it('rejects a packet whose declared length runs past the buffer', () => {
      const packet = buildPacket({
        channelId: 0x0010,
        dataType: 0x09,
        body: new Uint8Array(16)
      });
      const truncated = packet.subarray(0, packet.byteLength - 4);

      expect(() => adapter.parsePacket(truncated)).toThrowError(
        Chapter10Error,
        /truncated packet: complete packet/i
      );
      expect(() => adapter.parseStream(truncated)).toThrowError(Chapter10Error, /truncated/i);
    });

    it('rejects a packet whose data type disagrees with the channel map', () => {
      const packet = buildPacket({ channelId: 0x0010, dataType: MIL_STD_1553_FORMAT_1 });

      expect(() => adapter.parsePacket(packet.buffer)).toThrowError(
        Chapter10Error,
        /channel map expects/i
      );
    });

    it('walks back-to-back packets in a stream', () => {
      const first = buildPacket({
        channelId: 0x0010,
        dataType: 0x09,
        sequenceNumber: 1,
        body: new Uint8Array(6)
      });
      const second = buildPacket({
        channelId: 0x0020,
        sequenceNumber: 2,
        body: build1553Body([{ blockStatus: BUS_B, wordCount: 2 }])
      });
      const stream = new Uint8Array(first.byteLength + second.byteLength);
      stream.set(first, 0);
      stream.set(second, first.byteLength);

      const packets = adapter.parseStream(stream.buffer);

      expect(packets.length).toBe(2);
      expect(packets[0].header.sequenceNumber).toBe(1);
      expect(packets[0].header.packetLength).toBe(32);
      expect(packets[1].header.sequenceNumber).toBe(2);
      expect(packets[1].busHealth.B.messages).toBe(1);
    });

    it('rejects a stream with trailing partial bytes', () => {
      const packet = buildPacket({ channelId: 0x0010, dataType: 0x09 });
      const stream = new Uint8Array(packet.byteLength + 3);
      stream.set(packet, 0);

      expect(() => adapter.parseStream(stream.buffer)).toThrowError(
        Chapter10Error,
        /trailing bytes/i
      );
    });
  });
});
