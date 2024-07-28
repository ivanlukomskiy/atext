import {Geom3} from "@jscad/modeling/src/geometries/types";

export interface CvPolygonsSet {
    bounds: BoundingBox;
    polygons: CvPolygon[];
}

export interface CvPolygon {
    bounds: BoundingBox;
    points: Point[];
    parentIdx: number;
}

export type Span = [number, number];

export interface ExtrudedPolygon {
    mesh: Geom3;
    span: Span;
}

export interface Point {
    x: number;
    y: number;
}

export interface BoundingBox {
    top: number;
    left: number;
    bottom: number;
    right: number;
}

export enum ReductionStrategy {
    NONE = 'NONE',
    SIMPLE = 'SIMPLE',
}