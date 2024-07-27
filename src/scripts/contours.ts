const width = 10000;
const height = 1000;
const scale = .1;

function matInfo(name, mat) {
    // console.log('----------  ' + name +'  ------------')
    // console.log(name + " size", mat.rows, mat.cols, mat.channels());
    // console.log(name + " type", mat.type())
    // cv.imshow(name, mat);
}

function generatePolygons(text) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
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

    matInfo('original', mat)

    let gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    matInfo('gray', gray)

    let binary = new cv.Mat();
    cv.threshold(gray, binary, 128, 255, cv.THRESH_BINARY_INV);

    matInfo('binary', binary)

    let contours = new cv.MatVector();
    console.log('contours', contours)
    let hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_NONE);

    let leftTop = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    let rightBottom = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];

    // Step 4: Approximate contours as polylines
    let polylines = [];
    for (let i = 0; i < contours.size(); ++i) {
        let contour = contours.get(i);
        let parentIdx = hierarchy.intPtr(0, i)[3];
        let epsilon = 0.001 * cv.arcLength(contour, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, epsilon, true);
        let points = [];
        for (let j = 0; j < approx.rows; ++j) {
            let [x, y] = [approx.data32S[j * 2], approx.data32S[j * 2 + 1]];
            points.push([x * scale, y * scale]);
        }
        points.push([approx.data32S[0] * scale, approx.data32S[1] * scale])
        let boundingBox = getBoundingBox(points);
        leftTop = [
            Math.min(leftTop[0], boundingBox.leftTop[0]),
            Math.min(leftTop[1], boundingBox.leftTop[1]),
        ]
        rightBottom = [
            Math.max(rightBottom[0], boundingBox.rightBottom[0]),
            Math.max(rightBottom[1], boundingBox.rightBottom[1]),
        ]
        polylines.push({points, parent: parentIdx, boundingBox: boundingBox});
        approx.delete();
    }

    mat.delete();
    gray.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();

    return {polylines, boundingBox: {leftTop, rightBottom}};
}

function getBoundingBox(points) {
    let min = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    let max = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
    points.forEach(point => {
        min[0] = Math.min(min[0], point[0])
        min[1] = Math.min(min[1], point[1])
        max[0] = Math.max(max[0], point[0])
        max[1] = Math.max(max[1], point[1])
    })
    return {leftTop: [min[0], min[1]], rightBottom: [max[0], max[1]]};
}
