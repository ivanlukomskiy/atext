import {primitives} from '@jscad/modeling'
// @ts-expect-error no declarations for this package
import {serialize} from '@jscad/stl-serializer'

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