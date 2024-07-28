import {atom, WritableAtom} from 'nanostores'
import {Geom3} from "@jscad/modeling/src/geometries/types";

export const $textA = atom("SAMPLE")
export const $textB = atom("TEXT")
export const $font = atom("Arial")
export const $cvLoaded = atom(false)
export const $mesh: WritableAtom<Geom3[]> = atom([])
export const $camera: WritableAtom<any> = atom(null)
export const $bold: WritableAtom<any> = atom(false)
export const $italic: WritableAtom<any> = atom(false)