import {BoundingBox, CvPolygon, CvPolygonsSet, Figure, Point} from "../types.ts";
import {$bold, $font, $italic} from "../store.ts";
import * as Collections from 'typescript-collections';

const width = 10000;
const height = 1000;
const divider = 10;
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

    const polygonSetBounds = createBounds();

    const figures = splitIntoFigures(binary, {x: 0, y:0});
    const polygons: CvPolygon[] = []
    let polygonIdxOffset = 0;

    figures.map(figure => segmentize(figure)).reduce((acc, f) => [...acc, ...f], [])

    figures.forEach(figure => {
        // segmentize(figure, res)

        const newPolygons = extractPolygons(figure);
        newPolygons.forEach((p) => {
            if (p.parentIdx !== -1) {
                p.parentIdx += polygonIdxOffset;
            }
            polygons.push(p)
        })
        polygonIdxOffset += newPolygons.length;
    })

    polygons.forEach(polygon => {
        processPoint(polygonSetBounds, {x: polygon.bounds.left, y: polygon.bounds.top});
        processPoint(polygonSetBounds, {x: polygon.bounds.right, y: polygon.bounds.bottom});
    })

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

    console.log("res", res)

    mat.delete();
    gray.delete();
    binary.delete();

    return res;
}

function extractPolygons(figure: Figure): CvPolygon[] {
    const cv = window.cv;
    const {mask, offset} = figure;

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_NONE);

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
                x: approx.data32S[j * 2] + offset.x,
                y: approx.data32S[j * 2 + 1] + offset.y,
            });
        }
        points.push({  // enclose polygon
            x: approx.data32S[0] + offset.x,
            y: approx.data32S[1] + offset.y,
        });
        const polygonBounds = getBoundingBox(points);
        points.forEach(point => processPoint(polygonBounds, point))
        polygons.push({points, parentIdx: parentIdx, bounds: polygonBounds});
        approx.delete();
    }
    contours.delete();
    hierarchy.delete();
    return polygons;
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

function trim(mat: any) {
    const cv = window.cv;
    let rect = cv.boundingRect(mat);
    return mat.roi(rect).clone();
}

function drawRect(ctx: CanvasRenderingContext2D, start: Point, end: Point, color: string = 'blue') {
    ctx.strokeStyle = color; // Border color
    ctx.lineWidth = 10;
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
}

function splitIntoFigures(mask: any, initialOffset: Point): Figure[] {
    const cv = window.cv;
    let labels = new cv.Mat();
    let stats = new cv.Mat();
    let centroids = new cv.Mat();
    let numLabels = cv.connectedComponentsWithStats(mask, labels, stats, centroids);

    let res: Figure[] = [];
    for (let label = 1; label < numLabels; label++) {
        let mask = new cv.Mat();
        cv.compare(labels, new cv.Mat(labels.rows, labels.cols, labels.type(), [label, 0, 0, 0]), mask, cv.CMP_EQ);
        let count = cv.countNonZero(mask);
        let rect = cv.boundingRect(mask);
        let trimmed = trim(mask);
        res.push({mask: trimmed, offset: {x: rect.x + initialOffset.x, y: rect.y + initialOffset.y}});
        mask.delete()
    }

    labels.delete();
    stats.delete();
    centroids.delete();
    return res
}

let canvasIds = 0;

function imshow(mask: any): HTMLCanvasElement {
    const cv = window.cv;
    let parent = document.getElementById("segmentation") as HTMLDivElement;
    const canvas = document.createElement('canvas');
    canvas.width = mask.cols / 30;  // Set the width as needed
    canvas.height = mask.rows / 30;
    canvas.id = "canvas" + canvasIds;
    canvas.style.maxHeight = "100px";
    canvas.style.margin = "1px";
    // canvas.style.border = "1px solid black";
    canvasIds++;
    parent.appendChild(canvas);
    cv.imshow(canvas, mask)
    return canvas
}

function segmentize(figure: Figure): Figure[] {
    // todo check i delete all arrays
    const cv = window.cv;
    const {mask, offset} = figure;

    // splitIntoFigures(mask, offset);

    const canvas = imshow(mask)
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = getRandomColor();

    // const bottomHeight = polygonsSet.bounds.bottom - (polygonsSet.bounds.bottom - polygonsSet.bounds.top) / 20;
    const bottomHeight = Math.min(mask.rows - mask.rows / 20, mask.rows - 1)

    drawLine(ctx, {x: 0, y: bottomHeight}, {x: canvas.width - 1, y: bottomHeight}, 'lightgrey')

    let baseStart = null
    let basesCount = 0
    let sources: number[] = [];
    for (let x = 0; x < mask.cols + 1; x++) {
        let masked = x < mask.cols ? mask.ucharAt(bottomHeight, x) > 0 : false;
        if (masked && baseStart === null) {
            baseStart = x;
            basesCount++
        } else if (!masked && baseStart !== null) {
            const segmentLength = x - baseStart;
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
    if (sources.length > 2) {
        sources = [sources[0], sources[sources.length - 1]]
    }
    if (sources.length === 1) {
        return [figure]
    }

    const downscaleTimes = 10
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
            if (x < 0 || x >= downscaledMat.cols || y < 0 || y >= downscaledMat.rows) {
                continue
            }
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
            queue.add([x + 1, y, dist + 1])
            queue.add([x - 1, y, dist + 1])
            queue.add([x, y + 1, dist + 1])
            queue.add([x, y - 1, dist + 1])
            queue.add([x + 1, y + 1, dist + diagonalDist])
            queue.add([x + 1, y - 1, dist + diagonalDist])
            queue.add([x - 1, y + 1, dist + diagonalDist])
            queue.add([x - 1, y - 1, dist + diagonalDist])
        }
        maskClone.delete()
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

    const splitBounds: BoundingBox[] = []

    for (let distIdx1 = 0; distIdx1 < distMaps.length - 1; distIdx1++) {
        const distMap1 = distMaps[distIdx1];
        for (let distIdx2 = distIdx1 + 1; distIdx2 < distMaps.length; distIdx2++) {
            const distMap2 = distMaps[distIdx2];
            let matches = 0
            const bounds = createBounds()
            // it hurts, but it's necessary
            for (let x = 0; x < distMap1.cols; x++) {
                for (let y = 0; y < distMap1.rows; y++) {
                    const dist1 = distMap1.floatAt(y, x);
                    const dist2 = distMap2.floatAt(y, x);
                    if (dist1 < 0 || dist2 < 0) continue;
                    const diff = Math.abs(dist2 - dist1);
                    if (diff < 2) {
                        processPoint(bounds, {x: (x + 2) * downscaleTimes, y: (y + 2) * downscaleTimes})
                        processPoint(bounds, {x: (x - 2) * downscaleTimes, y: (y - 2) * downscaleTimes})
                        matches++
                        drawPoint(x * downscaleTimes, y * downscaleTimes, ctx, 'red')
                    }
                }
            }
            if (matches > 0) {
                splitBounds.push(bounds);
                drawRect(ctx, {x: bounds.left, y: bounds.top}, {x: bounds.right, y: bounds.bottom})
            }
        }
    }

    // recombine
    const maskWithoutBounds = mask.clone();
    let jointsMask = new cv.Mat(mask.rows, mask.cols, cv.CV_8UC1, new cv.Scalar(0));
    splitBounds.forEach((bounds) => {
        let topLeft = new cv.Point(Math.max(bounds.left, 0), Math.max(bounds.top, 0));
        let bottomRight = new cv.Point(Math.min(bounds.right, mask.cols - 1), Math.min(bounds.bottom, mask.rows - 1));
        console.log(maskWithoutBounds, maskWithoutBounds.type())
        cv.rectangle(maskWithoutBounds, topLeft, bottomRight, new cv.Scalar(0), cv.FILLED);
        cv.rectangle(jointsMask, topLeft, bottomRight, new cv.Scalar(255), cv.FILLED);
    })
    cv.bitwise_and(jointsMask, mask, jointsMask);

    const joint: Figure = {mask: jointsMask, offset}
    const splitFigures = splitIntoFigures(maskWithoutBounds, offset);
    if (splitFigures.length === 1) {
        console.error("Segmentation failed to split figure")
        return [figure]
    }
    if (splitFigures.length > 2) {
        console.error("Too many segments produced", splitFigures.length)
        return [figure]
    }
    const joint1 = tryJoinFigures(splitFigures[0], joint);
    imshow(joint1.mask)
    const joint2 = tryJoinFigures(splitFigures[1], joint);
    imshow(joint2.mask)
    return [joint1, joint2]
}

function tryJoinFigures(f1: Figure, f2: Figure): Figure {
    const cv = window.cv;
    const start = {
        x: Math.min(f1.offset.x, f2.offset.x),
        y: Math.min(f1.offset.y, f2.offset.y)
    };
    const end = {
        x: Math.max(f1.offset.x + f1.mask.cols, f2.offset.x + f2.mask.cols),
        y: Math.max(f1.offset.y + f1.mask.rows, f2.offset.y + f2.mask.rows),
    }
    const width = end.x - start.x;
    const height = end.y - start.y;

    let mask1 = new cv.Mat(height, width, cv.CV_8UC1, new cv.Scalar(0));
    let mask2 = new cv.Mat(height, width, cv.CV_8UC1, new cv.Scalar(0));
    let roi1 = mask1.roi(new cv.Rect(f1.offset.x - start.x, f1.offset.y - start.y, f1.mask.cols, f1.mask.rows));
    let roi2 = mask2.roi(new cv.Rect(f2.offset.x - start.x, f2.offset.y - start.y, f2.mask.cols, f2.mask.rows));
    f1.mask.copyTo(roi1);
    f2.mask.copyTo(roi2);
    cv.bitwise_or(mask1, mask2, mask1);
    // printNonZeroPercentage(mask1, 'joint mask')
    return {mask: mask1, offset: start}
}

function printNonZeroPercentage(mat: any, name: string) {
    const cv = window.cv;
    let nonZeroCount = cv.countNonZero(mat);
    let totalElements = mat.rows * mat.cols;
    let percentage = (nonZeroCount / totalElements) * 100;
    console.log(`${name} fullness: ${percentage.toFixed(2)}%`);
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
