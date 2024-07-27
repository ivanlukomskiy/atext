import {Button, Stack, TextInput} from "@mantine/core";
import {useStore} from "@nanostores/react";
import {$textA, $textB} from "../../store.ts";
import {useCallback} from "react";
import {generatePolygons} from "../../scripts/contours.ts";

function FormGenerate() {
    const textA = useStore($textA)
    const textB = useStore($textB)

    const generate = useCallback(() => {
        const test = generatePolygons(textA)
        console.log("test", test)
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