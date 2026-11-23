// Self-contained ISO/IEC 18004 QR Code (Byte mode, ECC Level M, Versions 1-9) SVG generator

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

function rsGeneratorPoly(ecCount: number): number[] {
  let poly = [1];
  for (let i = 0; i < ecCount; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: number[], ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i += 1) {
    const factor = data[i] ^ res[0];
    for (let j = 0; j < ecCount - 1; j += 1) res[j] = res[j + 1];
    res[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j += 1) res[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return res;
}

const VERSION_SPEC_M: Record<
  number,
  { totalData: number; ecPerBlock: number; groups: Array<[number, number]>; align: number[] }
> = {
  1: { totalData: 16, ecPerBlock: 10, groups: [[1, 16]], align: [] },
  2: { totalData: 28, ecPerBlock: 16, groups: [[1, 28]], align: [6, 18] },
  3: { totalData: 44, ecPerBlock: 26, groups: [[1, 44]], align: [6, 22] },
  4: { totalData: 64, ecPerBlock: 18, groups: [[2, 32]], align: [6, 26] },
  5: { totalData: 86, ecPerBlock: 24, groups: [[2, 43]], align: [6, 30] },
  6: { totalData: 108, ecPerBlock: 16, groups: [[4, 27]], align: [6, 34] },
  7: { totalData: 124, ecPerBlock: 18, groups: [[4, 31]], align: [6, 22, 38] },
  8: { totalData: 154, ecPerBlock: 22, groups: [[2, 38], [2, 39]], align: [6, 24, 42] },
  9: { totalData: 182, ecPerBlock: 22, groups: [[3, 36], [2, 37]], align: [6, 26, 46] },
};

function selectVersion(byteLen: number): number {
  for (let v = 1; v <= 9; v += 1) {
    const capBytes = Math.floor((VERSION_SPEC_M[v].totalData * 8 - 12) / 8);
    if (byteLen <= capBytes) return v;
  }
  return 9;
}

function encodeCodewords(bytes: Uint8Array, version: number): number[] {
  const spec = VERSION_SPEC_M[version];
  const maxBytes = Math.floor((spec.totalData * 8 - 12) / 8);
  const payload = bytes.slice(0, maxBytes);
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1);
  };

  pushBits(0b0100, 4);
  pushBits(payload.length, 8);
  for (let i = 0; i < payload.length; i += 1) pushBits(payload[i], 8);

  const totalBits = spec.totalData * 8;
  const termLen = Math.min(4, totalBits - bits.length);
  pushBits(0, termLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataWords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j += 1) b = (b << 1) | bits[i + j];
    dataWords.push(b);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataWords.length < spec.totalData) {
    dataWords.push(padBytes[padIdx % 2]);
    padIdx += 1;
  }

  const dataBlocks: number[][] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const [count, len] of spec.groups) {
    for (let b = 0; b < count; b += 1) {
      const block = dataWords.slice(offset, offset + len);
      offset += len;
      dataBlocks.push(block);
      ecBlocks.push(rsRemainder(block, spec.ecPerBlock));
    }
  }

  const interleaved: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i += 1) {
    for (const block of dataBlocks) if (i < block.length) interleaved.push(block[i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const ec of ecBlocks) interleaved.push(ec[i]);
  }
  return interleaved;
}

function formatBitsM(maskId: number): number {
  const data = (0b00 << 3) | maskId;
  let rem = data << 10;
  const gen = 0b10100110111;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >>> i) & 1) rem ^= gen << (i - 10);
  }
  return ((data << 10) | rem) ^ 0b101010000010010;
}

function versionBits(version: number): number {
  let rem = version << 12;
  const gen = 0b1111100100101;
  for (let i = 17; i >= 12; i -= 1) {
    if ((rem >>> i) & 1) rem ^= gen << (i - 12);
  }
  return (version << 12) | rem;
}

function buildMatrix(version: number, codewords: number[]) {
  const size = version * 4 + 17;
  const grid = Array.from({ length: size }, () => new Int8Array(size));
  const isFunc = Array.from({ length: size }, () => new Uint8Array(size));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    grid[r][c] = dark ? 2 : 1;
    isFunc[r][c] = 1;
  };

  const drawFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        setFunc(r, c, dist !== 2 && dist !== 4);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  const centers = VERSION_SPEC_M[version].align;
  for (const r of centers) {
    for (const c of centers) {
      if (isFunc[r][c]) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          setFunc(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i += 1) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }
  setFunc(4 * version + 9, 8, true);

  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    setFunc(8, size - 1 - i, false);
    if (i < 7) setFunc(size - 1 - i, 8, false);
  }

  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i += 1) {
      const bit = Boolean((vb >>> i) & 1);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (let lr = 0; lr < 2; lr += 1) {
        const c = right - lr;
        if (isFunc[r][c]) continue;
        let dark = false;
        if (bitIndex < totalBits) {
          dark = Boolean((codewords[bitIndex >> 3] >>> (7 - (bitIndex & 7))) & 1);
          bitIndex += 1;
        }
        grid[r][c] = dark ? 2 : 1;
      }
    }
    upward = !upward;
  }

  return { size, grid, isFunc };
}

const MASK_FNS: Array<(r: number, c: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyFormatAndMask(size: number, baseGrid: Int8Array[], isFunc: Uint8Array[], maskId: number) {
  const mat = baseGrid.map((row) => new Uint8Array(row.length));
  const fn = MASK_FNS[maskId];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const dark = baseGrid[r][c] === 2;
      mat[r][c] = !isFunc[r][c] && fn(r, c) ? (dark ? 0 : 1) : dark ? 1 : 0;
    }
  }
  const fb = formatBitsM(maskId);
  const putFmt = (r: number, c: number, bitPos: number) => {
    mat[r][c] = (fb >>> bitPos) & 1;
  };
  for (let i = 0; i <= 5; i += 1) putFmt(8, i, 14 - i);
  putFmt(8, 7, 8);
  putFmt(8, 8, 7);
  putFmt(7, 8, 6);
  for (let i = 0; i <= 5; i += 1) putFmt(5 - i, 8, 5 - i);
  for (let i = 0; i <= 6; i += 1) putFmt(size - 1 - i, 8, 14 - i);
  for (let i = 0; i <= 7; i += 1) putFmt(8, size - 8 + i, 7 - i);
  return mat;
}

function penaltyScore(mat: Uint8Array[], size: number) {
  let penalty = 0;
  for (let r = 0; r < size; r += 1) {
    let runColor = mat[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c += 1) {
      if (mat[r][c] === runColor) {
        runLen += 1;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = mat[r][c];
        runLen = 1;
      }
    }
  }
  for (let c = 0; c < size; c += 1) {
    let runColor = mat[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r += 1) {
      if (mat[r][c] === runColor) {
        runLen += 1;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = mat[r][c];
        runLen = 1;
      }
    }
  }
  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = mat[r][c];
      if (v === mat[r][c + 1] && v === mat[r + 1][c] && v === mat[r + 1][c + 1]) penalty += 3;
    }
  }
  let darkCount = 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) if (mat[r][c]) darkCount += 1;
  }
  const pct = (darkCount * 100) / (size * size);
  penalty += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return penalty;
}

export function encodeQrMatrix(text: string) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  const version = selectVersion(bytes.length);
  const codewords = encodeCodewords(bytes, version);
  const { size, grid, isFunc } = buildMatrix(version, codewords);

  let bestMat: Uint8Array[] = [];
  let bestScore = Infinity;
  for (let m = 0; m < 8; m += 1) {
    const candidate = applyFormatAndMask(size, grid, isFunc, m);
    const score = penaltyScore(candidate, size);
    if (score < bestScore) {
      bestScore = score;
      bestMat = candidate;
    }
  }
  return { version, size, matrix: bestMat };
}

export function buildQrPathData(text: string, quietZone = 2) {
  const { size, matrix } = encodeQrMatrix(text);
  const total = size + quietZone * 2;
  let d = '';
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (matrix[r][c]) {
        d += `M${c + quietZone},${r + quietZone}h1v1h-1z`;
      }
    }
  }
  return { total, path: d };
}

export function renderQrSvg(
  text: string,
  { sizePx = 92, quietZone = 3, fg = '#0F172A', bg = '#FFFFFF', label = 'Verification QR Code' } = {}
) {
  const { total, path } = buildQrPathData(text, quietZone);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" role="img" aria-label="${String(label).replace(/"/g, '&quot;')}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>`;
}
