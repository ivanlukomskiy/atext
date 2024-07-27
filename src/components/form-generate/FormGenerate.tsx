import {Button, Stack, TextInput} from "@mantine/core";
import {useStore} from "@nanostores/react";
import {$textA, $textB} from "../../store.ts";

function FormGenerate() {
    const textA = useStore($textA)
    const textB = useStore($textB)
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
        <Button>Generate</Button>
    </Stack>
}

export default FormGenerate;