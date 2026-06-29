export interface Rectangle {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function calculateMapPadding(
  map: Rectangle,
  overlays: readonly Rectangle[],
  edgePadding = 0,
): MapPadding {
  const mapWidth = Math.max(0, map.right - map.left);
  const mapHeight = Math.max(0, map.bottom - map.top);
  const padding: MapPadding = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  for (const overlay of overlays) {
    const horizontalOverlap = Math.max(
      0,
      Math.min(map.right, overlay.right) - Math.max(map.left, overlay.left),
    );
    const verticalOverlap = Math.max(
      0,
      Math.min(map.bottom, overlay.bottom) - Math.max(map.top, overlay.top),
    );
    if (horizontalOverlap === 0 || verticalOverlap === 0) continue;

    const candidates: Array<{ edge: keyof MapPadding; size: number }> = [];
    if (overlay.left <= map.left && overlay.right > map.left) {
      candidates.push({
        edge: "left",
        size: Math.min(mapWidth, overlay.right - map.left),
      });
    }
    if (overlay.right >= map.right && overlay.left < map.right) {
      candidates.push({
        edge: "right",
        size: Math.min(mapWidth, map.right - overlay.left),
      });
    }
    if (overlay.top <= map.top && overlay.bottom > map.top) {
      candidates.push({
        edge: "top",
        size: Math.min(mapHeight, overlay.bottom - map.top),
      });
    }
    if (overlay.bottom >= map.bottom && overlay.top < map.bottom) {
      candidates.push({
        edge: "bottom",
        size: Math.min(mapHeight, map.bottom - overlay.top),
      });
    }

    const shallowestOverlap = Math.min(
      ...candidates.map((candidate) => candidate.size),
    );
    for (const candidate of candidates) {
      if (candidate.size !== shallowestOverlap) continue;
      padding[candidate.edge] = Math.max(
        padding[candidate.edge],
        candidate.size,
      );
    }
  }

  const horizontalMargin = Math.min(
    edgePadding,
    Math.max(0, (mapWidth - padding.left - padding.right - 1) / 2),
  );
  const verticalMargin = Math.min(
    edgePadding,
    Math.max(0, (mapHeight - padding.top - padding.bottom - 1) / 2),
  );
  return {
    top: padding.top + verticalMargin,
    right: padding.right + horizontalMargin,
    bottom: padding.bottom + verticalMargin,
    left: padding.left + horizontalMargin,
  };
}
