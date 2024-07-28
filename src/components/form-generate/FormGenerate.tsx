import {Button, Stack, TextInput} from "@mantine/core";
import {useStore} from "@nanostores/react";
import {$textA, $textB} from "../../store.ts";
import {useCallback} from "react";
import {generatePolygons} from "../../scripts/contours.ts";
import {combineWithOverlap, combineZigZag, fuseLetters} from "../../scripts/jscad.ts";

const extrusionDist = 500;

function FormGenerate() {
    const textA = useStore($textA)
    const textB = useStore($textB)

    const generate = useCallback(() => {
        const polyA = generatePolygons(textA)
        const polyB = generatePolygons(textB)
        const extrusionsA = fuseLetters(polyA, extrusionDist, -Math.PI / 4)
        const extrusionsB = fuseLetters(polyB, extrusionDist, Math.PI / 4)
        console.log("extrusionsB", extrusionsB)
        const combine = combineZigZag(extrusionsA, extrusionsB)
        console.log("combine", combine);
    }, [textA, textB]);

    return <Stack>
        {/*<Title>set text</Title>*/}
        <TextInput
            label="side a"
            placeholder="left side text"
            value={textA}
            onChange={(event) => $textA.set(event.currentTarget.value)}
        />
        <TextInput
            label="side b"
            placeholder="right side text"
            value={textB}
            onChange={(event) => $textB.set(event.currentTarget.value)}
        />
        <Button onClick={generate}>Generate</Button>
    </Stack>
}

export default FormGenerate;