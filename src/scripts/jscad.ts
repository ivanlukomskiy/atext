import {booleans, colors, extrusions, primitives, transforms} from '@jscad/modeling'
// @ts-expect-error no declarations for this package
import {serialize} from '@jscad/stl-serializer'
import {CvPolygon, CvPolygonsSet, ExtrudedPolygon, Span} from "../types.ts";
import {getMidPoint} from "./contours.ts";
import {Geom3} from "@jscad/modeling/src/geometries/types";

const jscadPolygon = primitives.polygon;
const {extrudeLinear} = extrusions;
const {colorize} = colors;
const {union, subtract, intersect} = booleans;
const {translate, rotate} = transforms

export const createAndSerialize = () => {
    const cube = primitives.cuboid({size: [10, 10, 10]})
    const stlData = serialize({binary: true}, cube)
    const blob = new Blob(stlData)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model.stl';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function to2dJscad(polygon: CvPolygon) {
    return jscadPolygon({points: polygon.points.map(p => [p.x, p.y])})
}


export function fuseLetters(polygonsSet: CvPolygonsSet, extrudeHeight: number, rotation: number): ExtrudedPolygon[] {
    // todo handle composite letters

    const middle = getMidPoint(polygonsSet.bounds);

    const polygons: (ExtrudedPolygon | null)[] = []
    polygonsSet.polygons.forEach((polygon) => {
        if (polygon.parentIdx !== -1) {
            const polygon2d = to2dJscad(polygon)
            const hole = extrudeLinear({height: extrudeHeight}, polygon2d);
            polygons[polygon.parentIdx]!.mesh = colorize([1, 0, 0], subtract(polygons[polygon.parentIdx]!.mesh, hole));
            polygons.push(null);
        } else {
            const points = polygon.points;
            points.reverse();  // jscad expects opposite order of points for outer surface
            const polygon2d = to2dJscad(polygon)
            const mesh = colorize([0, 1, 0], extrudeLinear({height: extrudeHeight}, polygon2d))
            const segmentSpan: Span = [polygon.bounds.left, polygon.bounds.right]
            polygons.push({mesh, span: segmentSpan})
        }
    })

    return polygons
        .filter(polygon => polygon !== null)
        .map(polygon => {
            let mesh = translate([-middle.x, -middle.y, -extrudeHeight / 2], polygon.mesh)
            mesh = rotate([0, rotation, 0], mesh)
            mesh = rotate([Math.PI / 2, Math.PI, -Math.PI / 2], mesh)
            return {...polygon, mesh}
        })
}

function sortBySpanStart(a: ExtrudedPolygon, b: ExtrudedPolygon) {
    return a.span[0] - b.span[0];
}

type Normalizer = (polygon: ExtrudedPolygon) => number

function createNormalizer(polygons: ExtrudedPolygon[]): Normalizer {
    const min = polygons.reduce((acc, poly) => Math.min(acc, poly.span[0]), Number.MAX_SAFE_INTEGER);
    const max = polygons.reduce((acc, poly) => Math.max(acc, poly.span[1]), Number.MIN_SAFE_INTEGER);
    return (polygon: ExtrudedPolygon) => {
        return (polygon.span[0] - min) / (max - min);
    }
}

export function combineWithOverlap(extrusionsA: ExtrudedPolygon[], extrusionsB: ExtrudedPolygon[]) {
    extrusionsA.sort(sortBySpanStart)
    extrusionsB.sort(sortBySpanStart)
    const normA = createNormalizer(extrusionsA);
    const normB = createNormalizer(extrusionsB);

    // const long = objectsInfo1.len > objectsInfo2.len ? objectsInfo1 : objectsInfo2;
    // const short = objectsInfo1.len > objectsInfo2.len ? objectsInfo2 : objectsInfo1;

    const res: Geom3[] = []
    let indexA = 0
    let indexB = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
        // fuse o1 and o2
        res.push(intersect(extrusionsA[indexA].mesh, extrusionsB[indexB].mesh))
        const nextO1Phase = indexA < extrusionsA.length - 1 ? normA(extrusionsA[indexA + 1]) : null;
        const nextO2Phase = indexB < extrusionsB.length - 1 ? normB(extrusionsB[indexB + 1]) : null;
        if (nextO1Phase === null && nextO2Phase === null) {
            break
        }
        if (nextO1Phase === null || nextO2Phase !== null && nextO2Phase < nextO1Phase) {
            indexB++
        } else {
            indexA++
        }
    }
    return res
}

function unionAll(objects: ExtrudedPolygon[]): Geom3 {
    const res = objects.reduce((acc: Geom3 | null, polygon: ExtrudedPolygon) => {
        return acc ? union(acc, polygon.mesh) : polygon.mesh;
    }, null);
    return res!;
}

export function combineZigZag(extrusionsA: ExtrudedPolygon[], extrusionsB: ExtrudedPolygon[]) {
    extrusionsA.sort(sortBySpanStart)
    extrusionsB.sort(sortBySpanStart)

    // just fuse together
    let res = null
    const text1 = unionAll(extrusionsA)
    const text2 = unionAll(extrusionsB)
    res = [intersect(text1, text2)]
    // res = [text1]


    return res
}