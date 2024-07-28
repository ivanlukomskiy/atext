import {BoundingBox, CvPolygon, CvPolygonsSet, Point} from "../types.ts";
import {$bold, $font, $italic} from "../store.ts";
import * as Collections from 'typescript-collections';

const width = 10000;
const height = 1000;
const divider = 1;
const precision = 0.001;

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


    ctx.font = `${$italic.get() ? 'italic ' : ''}${$bold.get() ? 'bold ' : ''}720px \"${$font.get()}\"`;

    ctx.fillStyle = 'black';
    ctx.fillText(text, 100, 900);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mat = cv.matFromImageData(imgData);

    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    const binary = new cv.Mat();
    cv.threshold(gray, binary, 128, 255, cv.THRESH_BINARY_INV);

    // console.log('dimensions', mat.cols, mat.rows,)
    // console.log("v1",  mat.ucharAt(2000, 2000))
    // console.log("v1",  mat.ucharAt(8000, 2000))

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_NONE);

    const polygonSetBounds = createBounds();

    const polygons: CvPolygon[] = [];
    for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const parentIdx = hierarchy.intPtr(0, i)[3] as number;
        const epsilon = precision * cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, epsilon, true);
        const points: Point[] = [];
        for (let j = 0; j < approx.rows; ++j) {
            points.push({
                x: approx.data32S[j * 2],
                y: approx.data32S[j * 2 + 1],
            });
        }
        points.push({  // enclose polygon
            x: approx.data32S[0],
            y: approx.data32S[1],
        });
        const polygonBounds = getBoundingBox(points);
        points.forEach(point => processPoint(polygonSetBounds, point))
        points.forEach(point => processPoint(polygonBounds, point))
        polygons.push({points, parentIdx: parentIdx, bounds: polygonBounds});
        approx.delete();
    }

    const res = {polygons, bounds: polygonSetBounds}

    // downscale
    downscale(res.bounds, divider)
    res.polygons.forEach(polygon => {
        downscale(polygon.bounds, divider)
        polygon.points.forEach((point: Point) => {
            point.x /= divider
            point.y /= divider
        })
    })

    segmentize(binary, res)

    mat.delete();
    gray.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();

    return res;
}

function getRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 100%, 50%)`;
}

function drawPoint(x: number, y: number, ctx: CanvasRenderingContext2D, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fill();
}

function drawLine(ctx: CanvasRenderingContext2D, start: Point, end: Point, color = 'red', lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

const longSegmentThreshold = 200

function segmentize(mask: any, polygonsSet: CvPolygonsSet) {
    // todo check i delete all arrays
    const cv = window.cv;
    cv.imshow("segmentation", mask)

    let canvas = document.getElementById("segmentation") as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = getRandomColor();

    const bottomHeight = polygonsSet.bounds.bottom - (polygonsSet.bounds.bottom - polygonsSet.bounds.top) / 20;

    drawLine(ctx, {x: 0, y: bottomHeight}, {x: canvas.width - 1, y: bottomHeight}, 'lightgrey')

    let baseStart = null
    let basesCount = 0
    let sources: number[] = [];
    for (let x = 0; x < mask.cols; x++) {
        let masked = mask.ucharAt(bottomHeight, x) > 0;
        if (masked && baseStart === null) {
            baseStart = x;
            basesCount++
        } else if (!masked && baseStart !== null) {
            const segmentLength = x - baseStart;
            console.log("segmentLength", segmentLength)
            if (segmentLength > longSegmentThreshold) {
                const segment1 = baseStart + segmentLength / 10;
                const segment2 = baseStart + segmentLength - segmentLength / 10;
                sources.push(segment1)
                sources.push(segment2)
                drawPoint(segment1, bottomHeight, ctx, 'red')
                drawPoint(segment2, bottomHeight, ctx, 'red')
            } else {
                let middle = (x - baseStart) / 2 + baseStart;
                sources.push(middle)
                drawPoint(middle, bottomHeight, ctx, 'red')
            }
            baseStart = null;
        }
    }

    const downscaleTimes = 20
    let downscaledMat = new cv.Mat();
    let newSize = new cv.Size(Math.round(mask.cols / downscaleTimes), Math.round(mask.rows / downscaleTimes));
    cv.resize(mask, downscaledMat, newSize, 0, 0, cv.INTER_AREA);

    const start = new Date().getTime();
    const distMaps = sources.map((sourceX) => {
        const queue: Collections.Queue<PointWithDist> = new Collections.Queue();
        let maskClone = downscaledMat.clone();// Assuming you have your binary Mat called 'binaryMat'
        let distMap = new cv.Mat(downscaledMat.rows, downscaledMat.cols, cv.CV_32F, new cv.Scalar(-1));
        let maxDist = 0;
        queue.add([sourceX / downscaleTimes, bottomHeight / downscaleTimes, 0])
        const diagonalDist = Math.sqrt(2);
        let iteration = 0;
        while (!queue.isEmpty() && iteration < 1_000_000) {
            iteration++
            const [x, y, dist] = queue.dequeue()!;
            const masked = downscaledMat.ucharAt(y, x) > 0;
            if (!masked) continue
            const isNew = maskClone.ucharAt(y, x) > 0;
            if (!isNew) {
                const currentDist = distMap.floatAt(y, x);
                if (dist < currentDist) {
                    distMap.floatPtr(y, x)[0] = dist;
                }
                continue
            }
            drawPoint(x * downscaleTimes, y * downscaleTimes, ctx, 'green')
            maskClone.ucharPtr(y, x)[0] = 0;
            distMap.floatPtr(y, x)[0] = dist;
            maxDist = Math.max(maxDist, dist)
            queue.add([x+1, y, dist + 1])
            queue.add([x-1, y, dist + 1])
            queue.add([x, y+1, dist + 1])
            queue.add([x, y-1, dist + 1])
            queue.add([x+1, y+1, dist + diagonalDist])
            queue.add([x+1, y-1, dist + diagonalDist])
            queue.add([x-1, y+1, dist + diagonalDist])
            queue.add([x-1, y-1, dist + diagonalDist])
        }
        maskClone.delete()
        console.log(`dist 1: min=${cv.minMaxLoc(distMap).minVal}, max=${cv.minMaxLoc(distMap).maxVal}`);
        console.log("iteration", iteration)
        console.log("maxDist", maxDist)
        return distMap;
    })

    // const distMap1 = distMaps[0]
    // const maxDist = cv.minMaxLoc(distMap1).maxVal;
    // for (let x = 0; x < distMap1.cols; x++) {
    //     for (let y = 0; y < distMap1.rows; y++) {
    //         const dist = distMap1.floatAt(y, x);
    //         if (dist < 0) continue;
    //         const color = `hsl(100, 100%, ${100-dist * 100 / maxDist}%)`;
    //         drawPoint(x * downscaleTimes, y * downscaleTimes, ctx, color)
    //     }
    // }

    sources.forEach(source => {
        drawPoint(source, bottomHeight, ctx, 'red')
    })

    // if (true) return

    console.log("segmentation time", new Date().getTime() - start)

    for (let distIdx1 = 0; distIdx1 < distMaps.length - 1; distIdx1++) {
        const distMap1 = distMaps[distIdx1];
        for (let distIdx2 = distIdx1+1; distIdx2 < distMaps.length; distIdx2++) {
            const distMap2 = distMaps[distIdx2];
            let matches = 0

            // it hurts, but it's necessary
            for (let x = 0; x < distMap1.cols; x++) {
                for (let y = 0; y < distMap1.rows; y++) {
                    const dist1 = distMap1.floatAt(y, x);
                    const dist2 = distMap2.floatAt(y, x);
                    if (dist1 < 0 || dist2 < 0) continue;
                    const diff = Math.abs(dist2-dist1);
                    if (diff < 2) {
                        matches++
                        drawPoint(x * downscaleTimes, y * downscaleTimes, ctx, 'red')
                    }
                }
            }
        }
    }
}

type PointWithDist = [number, number, number]

function createBounds(): BoundingBox {
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
    bounds.top = Math.min(bounds.top, point.y);
    bounds.bottom = Math.max(bounds.bottom, point.y);
}

function downscale(bounds: BoundingBox, divider: number) {
    bounds.top /= divider
    bounds.right /= divider
    bounds.left /= divider
    bounds.bottom /= divider
}

function getBoundingBox(points: Point[]): BoundingBox {
    const bounds = createBounds();
    points.forEach(point => processPoint(bounds, point));
    return bounds;
}

export function getMidPoint(bounds: BoundingBox): Point {
    return {
        x: (bounds.left + bounds.right) / 2,
        y: (bounds.top + bounds.bottom) / 2,
    }
}
