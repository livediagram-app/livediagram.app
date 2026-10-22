// Max-flow / min-cut on an 8-connected pixel grid (Boykov and Kolmogorov, "An Experimental
// Comparison of Min-Cut/Max-Flow Algorithms for Energy Minimization in Vision", 2004): the cut that
// GrabCut (Select Subject, Remove Background) and Quick Select use to split a picture into the
// subject and the rest along its strongest edges.

// The eight neighbours, as offsets, each arc k's opposite at (k + 4) % 8.
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

const FREE = 0;
const SOURCE = 1;
const SINK = 2;
// parent values that are not arcs.
const NONE = -1;
const TERMINAL = -2;

export class GridGraph {
  readonly width: number;
  readonly height: number;
  // Each node's residual capacity to the source (positive) or the sink (negative).
  private readonly tr: Float64Array;
  // Each arc's residual capacity, node * 8 + direction.
  private readonly cap: Float32Array;
  private flow = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tr = new Float64Array(width * height);
    this.cap = new Float32Array(width * height * 8);
  }

  /** The capacities from the source and to the sink for a node (both may be set; they net out). */
  setTerminal(node: number, toSource: number, toSink: number): void {
    const d = Math.min(toSource, toSink);
    this.flow += d;
    this.tr[node] = toSource - toSink;
  }

  /** The capacity of the edge from `node` toward its neighbour in `dir`, both ways. */
  setEdge(node: number, dir: number, forward: number, backward: number): void {
    const x = node % this.width;
    const y = (node - x) / this.width;
    const nx = x + DX[dir]!;
    const ny = y + DY[dir]!;
    if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) return;
    const other = ny * this.width + nx;
    this.cap[node * 8 + dir] = forward;
    this.cap[other * 8 + ((dir + 4) % 8)] = backward;
  }

  private neighbour(node: number, dir: number): number {
    const x = node % this.width;
    const y = (node - x) / this.width;
    const nx = x + DX[dir]!;
    const ny = y + DY[dir]!;
    if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) return -1;
    return ny * this.width + nx;
  }

  /** Runs the max-flow. Answers, per node, 1 on the source side (the subject) else 0, and the flow. */
  solve(): { side: Uint8Array; flow: number } {
    const n = this.width * this.height;
    const tree = new Uint8Array(n);
    const parent = new Int32Array(n).fill(NONE);
    // Distance to the terminal and when it was measured, for adoption's heuristic.
    const dist = new Int32Array(n);
    const stamp = new Int32Array(n);
    let time = 0;
    const active: number[] = [];
    const isActive = new Uint8Array(n);
    const orphans: number[] = [];
    const cap = this.cap;
    const tr = this.tr;

    const activate = (v: number) => {
      if (!isActive[v]) {
        isActive[v] = 1;
        active.push(v);
      }
    };
    for (let v = 0; v < n; v++) {
      if (tr[v]! > 0) {
        tree[v] = SOURCE;
        parent[v] = TERMINAL;
        dist[v] = 1;
        activate(v);
      } else if (tr[v]! < 0) {
        tree[v] = SINK;
        parent[v] = TERMINAL;
        dist[v] = 1;
        activate(v);
      }
    }

    let head = 0;
    // The arc joining the trees, from the source-side node, found by growth.
    let bridgeFrom: number;
    let bridgeDir = -1;

    // The direction from `v` to its parent: parent stores the direction of the arc from v to it.
    const parentOf = (v: number) => this.neighbour(v, parent[v]!);

    while (true) {
      // Growth.
      bridgeFrom = -1;
      while (head < active.length) {
        const p = active[head]!;
        if (tree[p] === FREE) {
          isActive[p] = 0;
          head++;
          continue;
        }
        let found = false;
        for (let dir = 0; dir < 8; dir++) {
          const q = this.neighbour(p, dir);
          if (q < 0) continue;
          const opp = (dir + 4) % 8;
          // The residual capacity in the direction of the tree's flow.
          const c = tree[p] === SOURCE ? cap[p * 8 + dir]! : cap[q * 8 + opp]!;
          if (c <= 0) continue;
          if (tree[q] === FREE) {
            tree[q] = tree[p]!;
            parent[q] = opp;
            stamp[q] = stamp[p]!;
            dist[q] = dist[p]! + 1;
            activate(q);
          } else if (tree[q] !== tree[p]) {
            if (tree[p] === SOURCE) {
              bridgeFrom = p;
              bridgeDir = dir;
            } else {
              bridgeFrom = q;
              bridgeDir = opp;
            }
            found = true;
            break;
          }
        }
        if (found) break;
        isActive[p] = 0;
        head++;
      }
      if (bridgeFrom < 0) break;
      // Compact the queue now and then.
      if (head > 4096 && head > active.length / 2) {
        active.splice(0, head);
        head = 0;
      }

      // Augmentation: the bottleneck along source -> ... -> bridgeFrom -> bridgeTo -> ... -> sink.
      time++;
      const bridgeTo = this.neighbour(bridgeFrom, bridgeDir);
      let bottleneck = cap[bridgeFrom * 8 + bridgeDir]!;
      for (let v = bridgeFrom; ;) {
        const a = parent[v]!;
        if (a === TERMINAL) {
          bottleneck = Math.min(bottleneck, tr[v]!);
          break;
        }
        const u = parentOf(v);
        // Flow runs u -> v: the arc from u toward v.
        bottleneck = Math.min(bottleneck, cap[u * 8 + ((a + 4) % 8)]!);
        v = u;
      }
      for (let v = bridgeTo; ;) {
        const a = parent[v]!;
        if (a === TERMINAL) {
          bottleneck = Math.min(bottleneck, -tr[v]!);
          break;
        }
        // Flow runs v -> parent.
        bottleneck = Math.min(bottleneck, cap[v * 8 + a]!);
        v = parentOf(v);
      }
      // Push it.
      cap[bridgeFrom * 8 + bridgeDir]! -= bottleneck;
      cap[bridgeTo * 8 + ((bridgeDir + 4) % 8)]! += bottleneck;
      for (let v = bridgeFrom; ;) {
        const a = parent[v]!;
        if (a === TERMINAL) {
          tr[v]! -= bottleneck;
          if (tr[v]! <= 0) {
            parent[v] = NONE;
            orphans.push(v);
          }
          break;
        }
        const u = parentOf(v);
        const ua = (a + 4) % 8;
        cap[u * 8 + ua]! -= bottleneck;
        cap[v * 8 + a]! += bottleneck;
        if (cap[u * 8 + ua]! <= 0) {
          parent[v] = NONE;
          orphans.push(v);
        }
        v = u;
      }
      for (let v = bridgeTo; ;) {
        const a = parent[v]!;
        if (a === TERMINAL) {
          tr[v]! += bottleneck;
          if (tr[v]! >= 0) {
            parent[v] = NONE;
            orphans.push(v);
          }
          break;
        }
        const u = parentOf(v);
        cap[v * 8 + a]! -= bottleneck;
        cap[u * 8 + ((a + 4) % 8)]! += bottleneck;
        if (cap[v * 8 + a]! <= 0) {
          parent[v] = NONE;
          orphans.push(v);
        }
        v = u;
      }
      this.flow += bottleneck;

      // Adoption.
      while (orphans.length) {
        const o = orphans.pop()!;
        const side = tree[o]!;
        let bestDir = -1;
        let bestDist = Infinity;
        for (let dir = 0; dir < 8; dir++) {
          const q = this.neighbour(o, dir);
          if (q < 0 || tree[q] !== side) continue;
          const opp = (dir + 4) % 8;
          const c = side === SOURCE ? cap[q * 8 + opp]! : cap[o * 8 + dir]!;
          if (c <= 0) continue;
          // Walk to the root to check q is rooted at the terminal.
          let d = 0;
          let v = q;
          let rooted = false;
          while (true) {
            if (stamp[v] === time) {
              d += dist[v]!;
              rooted = true;
              break;
            }
            const a = parent[v]!;
            d++;
            if (a === TERMINAL) {
              stamp[v] = time;
              dist[v] = 1;
              rooted = true;
              break;
            }
            if (a === NONE) break;
            v = this.neighbour(v, a);
          }
          if (rooted && d < bestDist) {
            bestDist = d;
            bestDir = dir;
            // Mark the path's distances.
            let w = q;
            let k = d;
            while (stamp[w] !== time) {
              stamp[w] = time;
              dist[w] = k--;
              w = this.neighbour(w, parent[w]!);
            }
          }
        }
        if (bestDir >= 0) {
          parent[o] = bestDir;
          stamp[o] = time;
          dist[o] = bestDist + 1;
          continue;
        }
        // No parent: o becomes free; its neighbours in the tree may grow back into it.
        for (let dir = 0; dir < 8; dir++) {
          const q = this.neighbour(o, dir);
          if (q < 0 || tree[q] !== side) continue;
          const opp = (dir + 4) % 8;
          const c = side === SOURCE ? cap[q * 8 + opp]! : cap[o * 8 + dir]!;
          if (c > 0) activate(q);
          const qa = parent[q]!;
          if (qa >= 0 && this.neighbour(q, qa) === o) {
            parent[q] = NONE;
            orphans.push(q);
          }
        }
        tree[o] = FREE;
      }
    }
    const side = new Uint8Array(n);
    for (let v = 0; v < n; v++) side[v] = tree[v] === SOURCE ? 1 : 0;
    return { side, flow: this.flow };
  }
}
