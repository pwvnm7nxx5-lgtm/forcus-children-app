(function attachReadingLayout(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.KANJI_READING_LAYOUT = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function normalizePositions(positions) {
    const seen = new Set();
    return (Array.isArray(positions) ? positions : [])
      .filter((position) => position && Number.isFinite(Number(position.row)) && Number.isFinite(Number(position.col)))
      .map((position, index) => ({
        ...position,
        row: Number(position.row),
        col: Number(position.col),
        sourceIndex: Number.isFinite(Number(position.sourceIndex))
          ? Number(position.sourceIndex)
          : index,
      }))
      .filter((position) => {
        const key = `${position.row}:${position.col}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  function getRuns(positions, orientation) {
    const sorted = positions.slice().sort((left, right) => (
      orientation === "vertical"
        ? left.col - right.col || left.row - right.row
        : left.row - right.row || left.col - right.col
    ));
    const runs = [];
    let current = [];

    sorted.forEach((position) => {
      const previous = current[current.length - 1];
      const sameLane = previous && (orientation === "vertical"
        ? previous.col === position.col
        : previous.row === position.row);
      const adjacent = sameLane && (orientation === "vertical"
        ? position.row === previous.row + 1
        : position.col === previous.col + 1);
      if (!adjacent) {
        if (current.length) {
          runs.push(current);
        }
        current = [position];
      } else {
        current.push(position);
      }
    });
    if (current.length) {
      runs.push(current);
    }
    return runs;
  }

  function makeFragment(positions, orientation) {
    const sorted = positions.slice().sort((left, right) => (
      orientation === "vertical"
        ? left.row - right.row
        : left.col - right.col
    ));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return {
      positions: sorted,
      row: first.row,
      col: first.col,
      span: orientation === "vertical"
        ? last.row - first.row + 1
        : last.col - first.col + 1,
      orientation,
    };
  }

  function buildReadingFragments(positions) {
    const normalized = normalizePositions(positions);
    if (!normalized.length) {
      return [];
    }
    // The page grid alternates wide main tracks and narrow ruby tracks. Only
    // adjacent cells in one ruby column are physically mergeable.
    return getRuns(normalized, "vertical").map((run) => makeFragment(run, "vertical"));
  }

  return {
    buildReadingFragments,
  };
});
