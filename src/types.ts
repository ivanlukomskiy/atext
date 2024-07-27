export interface CvPolygonsSet {
    boundingBox: BoundingBox;
    polygons: CvPolygon[];
}

export interface CvPolygon {
    boundingBox: BoundingBox;
    points: Point[];
    parentIdx: number;
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