import {BoundingBox, CvPolygon, CvPolygonsSet, Point} from "../types.ts";

const width = 10000;
const height = 1000;
const scale = .1;
const presicion = 0.001;

export function generatePolygons(text: string): CvPolygonsSet {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error("Failed to init canvas");
    }
    const cv = window.cv;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = 'lightgrey';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = '720px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText(text, 100, 900);

    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let mat = cv.matFromImageData(imgData);

    let gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    let binary = new cv.Mat();
    cv.threshold(gray, binary, 128, 255, cv.THRESH_BINARY_INV);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_NONE);

    const polygonSetBounds = getBlankBounds();

    let polygons: CvPolygon[] = [];
    for (let i = 0; i < contours.size(); ++i) {
        let contour = contours.get(i);
        let parentIdx = hierarchy.intPtr(0, i)[3] as number;
        let epsilon = presicion * cv.arcLength(contour, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, epsilon, true);
        let points: Point[] = [];
        for (let j = 0; j < approx.rows; ++j) {
            points.push({
                x: approx.data32S[j * 2] * scale,
                y: approx.data32S[j * 2 + 1] * scale,
            });
        }
        points.push({  // enclose polygon
            x: approx.data32S[0] * scale,
            y: approx.data32S[1] * scale,
        });
        let polygonBounds = getBoundingBox(points);
        points.forEach(point => processPoint(polygonSetBounds, point))
        points.forEach(point => processPoint(polygonBounds, point))
        polygons.push({points, parentIdx: parentIdx, boundingBox: polygonBounds});
        approx.delete();
    }

    mat.delete();
    gray.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();

    return {polygons, boundingBox: polygonSetBounds};
}

function getBlankBounds(): BoundingBox {
    return {
        left: Number.MAX_SAFE_INTEGER,
        right: Number.MIN_SAFE_INTEGER,
        top: Number.MAX_SAFE_INTEGER,
        bottom: Number.MIN_SAFE_INTEGER,
    }
}

function processPoint(bounds: BoundingBox, point: Point) {
    bounds.left = Math.min(bounds.left, point.x);
    bounds.right = Math.max(bounds.right, point.x);
    bounds.top = Math.min(bounds.top, point.x);
    bounds.bottom = Math.max(bounds.bottom, point.x);
}

function getBoundingBox(points: Point[]): BoundingBox {
    const bounds = getBlankBounds();
    points.forEach(point => processPoint(bounds, point));
    return bounds;
}
