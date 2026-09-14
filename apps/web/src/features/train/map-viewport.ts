export type TrainMapPan = Readonly<{ x: number; y: number }>;

/** Keep the visible rectangle inside the map when dragging or zooming out. */
export function clampTrainMapPan(
    bounds: Readonly<{ width: number; height: number }>,
    zoom: number,
    pan: TrainMapPan,
): TrainMapPan {
    const scale = Math.max(1, Math.min(3.5, zoom));
    const maxX = (bounds.width - bounds.width / scale) / 2;
    const maxY = (bounds.height - bounds.height / scale) / 2;
    return {
        x: Math.max(-maxX, Math.min(maxX, pan.x)),
        y: Math.max(-maxY, Math.min(maxY, pan.y)),
    };
}
