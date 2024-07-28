import {BoundingBox, CvPolygon, CvPolygonsSet, Point} from "../types.ts";
import {$bold, $font, $italic} from "../store.ts";
import {polygon} from "@jscad/modeling/src/primitives";
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

function segmentize(mask: any, polygonsSet: CvPolygonsSet) {
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
            let middle = (x - baseStart) / 2 + baseStart;
            sources.push(middle)
            drawPoint(middle, bottomHeight, ctx, 'red')
            baseStart = null;
        }
    }

    const downscaleTimes = 10
    let downscaledMat = new cv.Mat();
    let newSize = new cv.Size(Math.round(mask.cols / downscaleTimes), Math.round(mask.rows / downscaleTimes));
    cv.resize(mask, downscaledMat, newSize, 0, 0, cv.INTER_AREA);

    const start = new Date().getTime();
    sources.forEach((sourceX) => {
        const stack: Collections.Queue<PointWithDist> = new Collections.Queue();
        let maskClone = downscaledMat.clone();// Assuming you have your binary Mat called 'binaryMat'
        let distMap = new cv.Mat(downscaledMat.rows, downscaledMat.cols, cv.CV_32F, new cv.Scalar(-1));
        let maxDist = 0;
        stack.add([sourceX / downscaleTimes, bottomHeight / downscaleTimes, 0])
        const diagonalDist = Math.sqrt(2) / 2;
        let iteration = 0;
        while (!stack.isEmpty() && iteration < 1_000_000) {
            iteration++
            const [x, y, dist] = stack.dequeue()!;
            const isNew = maskClone.ucharAt(y, x) > 0;
            if (!isNew) {
                continue
            }
            drawPoint(x * downscaleTimes, y * downscaleTimes, ctx, 'green')
            maskClone.ucharPtr(y, x)[0] = 0;
            distMap.ucharPtr(y, x)[0] = dist;
            maxDist = Math.max(maxDist, dist)
            stack.add([x+1, y, dist + 1])
            stack.add([x-1, y, dist + 1])
            stack.add([x, y+1, dist + 1])
            stack.add([x, y-1, dist + 1])
            stack.add([x+1, y+1, dist + diagonalDist])
            stack.add([x+1, y-1, dist + diagonalDist])
            stack.add([x-1, y+1, dist + diagonalDist])
            stack.add([x-1, y-1, dist + diagonalDist])
        }
        console.log("iteration", iteration)
    })
    console.log("new Date().getTime() - start", new Date().getTime() - start)




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
